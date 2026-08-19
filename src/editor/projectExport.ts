import type { LayerDocumentTimelineRuntimePort } from "@/engines/timeline";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import type { LayerDocumentProject } from "@/models";
import {
  buildProjectExportAudioClips,
  createProjectExportAudioMix,
  type ProjectExportAudioResource,
} from "@/editor/projectExportAudio";
import { recordProjectVideo } from "@/editor/projectExportVideoRuntime";
import type { ExportDestination, ExportDestinationPort } from "@/gateway";
import type {
  ProjectExportFormat,
  ProjectExportProgress,
} from "@/shared/models/projectExportContract";
import {
  createReusableAccurateSurfaceFactory,
  drawRenderCommandsToContext,
  evaluateLayerDocumentFrame,
  renderAccurateFrame,
  type LayerDocumentSourceRuntimeResourcePort,
  type LayerDocumentSourceResolutionStatusReader,
} from "@/render";

export type {
  ProjectExportFormat,
  ProjectExportProgress,
} from "@/shared/models/projectExportContract";

export type ProjectExportDestination = ExportDestination;

export type ProjectExportOptions = {
  readonly format: ProjectExportFormat;
  readonly projectName: string;
  readonly renderFrame: (
    frame: number,
    target: HTMLCanvasElement,
    transparent: boolean
  ) => void | Promise<void>;
  readonly playback: LayerDocumentTimelineRuntimePort;
  readonly durationFrames: number;
  readonly frameRate: number;
  readonly onProgress: (progress: ProjectExportProgress) => void;
  readonly destination: ProjectExportDestination | null;
  readonly destinationPort: ExportDestinationPort;
  readonly project: LayerDocumentProject;
  readonly exportGroupLayerDocumentId: string;
  readonly resolveAudioResource: (sourceId: string) => ProjectExportAudioResource | null;
  readonly signal?: AbortSignal;
};

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const GIF_TARGET_FRAME_RATE = 30;
const WEBP_TARGET_FRAME_RATE = 30;
const GIF_SAMPLE_COUNT = 12;
const GIF_SAMPLE_PIXEL_STEP = 3;
const GIF_DITHER_MATRIX = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;

function writeAscii(target: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    target[offset + index] = value.charCodeAt(index);
  }
}

function writeUint24(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >> 8) & 0xff;
  target[offset + 2] = (value >> 16) & 0xff;
}

function makeRiffChunk(fourCC: string, payload: Uint8Array) {
  const chunk = new Uint8Array(8 + payload.byteLength + (payload.byteLength % 2));
  writeAscii(chunk, 0, fourCC);
  new DataView(chunk.buffer).setUint32(4, payload.byteLength, true);
  chunk.set(payload, 8);
  return chunk;
}

function joinBytes(parts: readonly Uint8Array[]) {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0)
  );
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.byteLength;
  });
  return output;
}

function extractWebPImageChunks(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Uint8Array[] = [];
  for (let offset = 12; offset + 8 <= bytes.byteLength;) {
    const fourCC = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const payloadSize = view.getUint32(offset + 4, true);
    const chunkSize = 8 + payloadSize + (payloadSize % 2);
    if (offset + chunkSize > bytes.byteLength) break;
    if (fourCC === "ALPH" || fourCC === "VP8 " || fourCC === "VP8L") {
      chunks.push(bytes.slice(offset, offset + chunkSize));
    }
    offset += chunkSize;
  }
  if (!chunks.some((chunk) => {
    const fourCC = String.fromCharCode(...chunk.subarray(0, 4));
    return fourCC === "VP8 " || fourCC === "VP8L";
  })) {
    throw new Error("WebP 프레임을 읽을 수 없습니다.");
  }
  return joinBytes(chunks);
}

async function encodeCanvasWebP(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.92);
  });
  if (!blob || blob.type !== "image/webp") {
    throw new Error("이 브라우저는 WebP 출력을 지원하지 않습니다.");
  }
  return extractWebPImageChunks(new Uint8Array(await blob.arrayBuffer()));
}

function assembleAnimatedWebP(options: {
  readonly width: number;
  readonly height: number;
  readonly frames: readonly { readonly chunks: Uint8Array; readonly duration: number }[];
}) {
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x12; // animation + alpha
  writeUint24(vp8x, 4, options.width - 1);
  writeUint24(vp8x, 7, options.height - 1);
  const anim = new Uint8Array(6); // transparent background, loop forever
  const frameChunks = options.frames.map((frame) => {
    const header = new Uint8Array(16);
    writeUint24(header, 6, options.width - 1);
    writeUint24(header, 9, options.height - 1);
    writeUint24(header, 12, Math.max(1, frame.duration));
    header[15] = 0x02; // replace the full canvas instead of blending old pixels
    return makeRiffChunk("ANMF", joinBytes([header, frame.chunks]));
  });
  const body = joinBytes([
    makeRiffChunk("VP8X", vp8x),
    makeRiffChunk("ANIM", anim),
    ...frameChunks,
  ]);
  const result = new Uint8Array(12 + body.byteLength);
  writeAscii(result, 0, "RIFF");
  new DataView(result.buffer).setUint32(4, result.byteLength - 8, true);
  writeAscii(result, 8, "WEBP");
  result.set(body, 12);
  return result;
}

function applyGifOrderedDither(
  pixels: Uint8ClampedArray,
  width: number
) {
  const strength = 18;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if ((pixels[offset + 3] ?? 0) <= 127) continue;
    const pixel = offset / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const threshold =
      ((GIF_DITHER_MATRIX[(y % 4) * 4 + (x % 4)] ?? 7.5) - 7.5) /
      7.5;
    const adjustment = threshold * strength;
    pixels[offset] = (pixels[offset] ?? 0) + adjustment;
    pixels[offset + 1] = (pixels[offset + 1] ?? 0) + adjustment;
    pixels[offset + 2] = (pixels[offset + 2] ?? 0) + adjustment;
  }
}

async function buildGifGlobalPalette(options: {
  readonly totalFrames: number;
  readonly output: HTMLCanvasElement;
  readonly renderFrame: ProjectExportOptions["renderFrame"];
}) {
  const context = options.output.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("GIF 색상표를 만들 수 없습니다.");
  const sampleCount = Math.min(GIF_SAMPLE_COUNT, options.totalFrames);
  const sampledPixels: number[] = [];
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const frame = sampleCount === 1
      ? 0
      : Math.round((sample / (sampleCount - 1)) * (options.totalFrames - 1));
    await options.renderFrame(frame, options.output, true);
    const pixels = context.getImageData(
      0,
      0,
      options.output.width,
      options.output.height
    ).data;
    for (let y = 0; y < options.output.height; y += GIF_SAMPLE_PIXEL_STEP) {
      for (let x = 0; x < options.output.width; x += GIF_SAMPLE_PIXEL_STEP) {
        const offset = (y * options.output.width + x) * 4;
        sampledPixels.push(
          pixels[offset] ?? 0,
          pixels[offset + 1] ?? 0,
          pixels[offset + 2] ?? 0,
          pixels[offset + 3] ?? 0
        );
      }
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return quantize(Uint8ClampedArray.from(sampledPixels), 256, {
    format: "rgba4444",
    oneBitAlpha: true,
    clearAlpha: true,
    clearAlphaThreshold: 127,
    clearAlphaColor: 0,
  });
}

export function createFullResolutionProjectRenderer(options: {
  readonly readProject: () => LayerDocumentProject;
  readonly resources: LayerDocumentSourceRuntimeResourcePort;
  readonly readSourceResolutionStatus: LayerDocumentSourceResolutionStatusReader;
  readonly cameraScalePercent: number;
  readonly activeGroupLayerDocumentId: string;
}) {
  const resolvePsdSource = options.resources.createPsdResolver();
  const surfaces = createReusableAccurateSurfaceFactory();
  return async (
    globalFrame: number,
    target: HTMLCanvasElement,
    transparent: boolean
  ) => {
    const project = options.readProject();
    const root = Object.values(project.payload.layerDocumentsById).find(
      (layer) => layer.type === "group" && layer.data.role === "project-root"
    );
    if (!root || root.type !== "group") {
      throw new Error("프로젝트 촬영범위를 찾을 수 없습니다.");
    }
    const evaluated = evaluateLayerDocumentFrame({
      project,
      activeGroupLayerDocumentId: options.activeGroupLayerDocumentId,
      globalFrame,
      sourceSamplingQuality: "original",
      resolvePsdSource,
      readSourceResolutionStatus: options.readSourceResolutionStatus,
    });
    if (!evaluated.ok) {
      throw new Error("프로젝트 프레임을 렌더링할 수 없습니다.");
    }
    const frame = renderAccurateFrame({
      evaluatedScene: evaluated.scene,
      resolveNodeVisual: (request) => {
        const resource = options.resources.resolve({
          sourceId: request.sourceId,
          sourceResourceCacheKey: request.sourceResourceCacheKey,
        });
        return resource
          ? {
              kind: "original",
              image: resource.resource as CanvasImageSource,
              pixelSize: resource.resolution.logicalSize,
            }
          : null;
      },
    });
    const context = target.getContext("2d");
    if (!context) throw new Error("출력 캔버스를 만들 수 없습니다.");
    const cameraScale = Math.max(1, options.cameraScalePercent) / 100;
    const cameraWidth = OUTPUT_WIDTH * cameraScale;
    const cameraHeight = OUTPUT_HEIGHT * cameraScale;
    const cameraX = root.data.width / 2 - cameraWidth / 2;
    const cameraY = root.data.height / 2 - cameraHeight / 2;
    const outputScale = target.width / cameraWidth;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, target.width, target.height);
    if (!transparent) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, target.width, target.height);
    }
    context.setTransform(
      outputScale,
      0,
      0,
      outputScale,
      -cameraX * outputScale,
      -cameraY * outputScale
    );
    surfaces.beginFrame();
    drawRenderCommandsToContext(
      context,
      frame.commands,
      surfaces.createSurface,
      1
    );
    surfaces.endFrame();
  };
}

function safeFileName(name: string) {
  return name.trim().replace(/[<>:"/\\|?*]/g, "-") || "umziq";
}

async function saveBlob(
  blob: Blob,
  fileName: string,
  destination: ProjectExportDestination | null,
  destinationPort: ExportDestinationPort
) {
  const result = await destinationPort.write(destination, { fileName, mimeType: blob.type || "application/octet-stream", bytes: new Uint8Array(await blob.arrayBuffer()) });
  if (!result.ok) throw new Error(result.message);
}

function videoType(format: ProjectExportFormat, includeAudio = true) {
  const candidates = format === "mp4"
    ? [
        ...(includeAudio ? ["video/mp4;codecs=avc1,mp4a.40.2"] : []),
        "video/mp4;codecs=avc1", "video/mp4",
      ]
    : [
        ...(includeAudio ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus"] : []),
        "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm",
      ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function isProjectExportFormatSupported(format: ProjectExportFormat) {
  if (format === "gif" || format === "webp") return true;
  if (typeof MediaRecorder === "undefined") return false;
  return Boolean(videoType(format));
}

export function projectVideoExtension(format: ProjectExportFormat) {
  if (format === "mp4") return "mp4";
  if (format === "gif") return "gif";
  return format === "webp" ? "webp" : "webm";
}

export async function exportProject(options: ProjectExportOptions) {
  const output = document.createElement("canvas");
  output.width = OUTPUT_WIDTH;
  output.height = OUTPUT_HEIGHT;
  options.playback.commands.pause();
  const throwIfAborted = () => {
    if (options.signal?.aborted) throw new DOMException("출력이 취소되었습니다.", "AbortError");
  };

  {
    const totalFrames = Math.max(1, Math.floor(options.durationFrames));
    const frameRate = Math.max(1, Math.round(options.frameRate));
    if (options.format === "gif") {
      const context = output.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("GIF 출력 화면을 만들 수 없습니다.");
      const encoder = GIFEncoder();
      const frameStep = Math.max(
        1,
        Math.round(frameRate / Math.min(GIF_TARGET_FRAME_RATE, frameRate))
      );
      const palette = await buildGifGlobalPalette({
        totalFrames,
        output,
        renderFrame: options.renderFrame,
      });
      const transparentIndex = palette.findIndex(
        (color) => color[3] === 0
      );
      for (let frame = 0; frame < totalFrames; frame += frameStep) {
        throwIfAborted();
        await options.renderFrame(frame, output, true);
        const pixels = context.getImageData(0, 0, output.width, output.height).data;
        applyGifOrderedDither(pixels, output.width);
        const index = applyPalette(pixels, palette, "rgba4444");
        encoder.writeFrame(index, output.width, output.height, {
          palette,
          delay: Math.round((1000 * frameStep) / frameRate),
          repeat: 0,
          transparent: transparentIndex >= 0,
          transparentIndex: Math.max(0, transparentIndex),
          dispose: 2,
        });
        options.onProgress({
          completedFrames: Math.min(frame + frameStep, totalFrames),
          totalFrames,
        });
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }
      encoder.finish();
      const gifBytes = Uint8Array.from(encoder.bytes());
      await saveBlob(
        new Blob([gifBytes.buffer], { type: "image/gif" }),
        `${safeFileName(options.projectName)}.gif`,
        options.destination,
        options.destinationPort
      );
      return;
    }
    if (options.format === "webp") {
      const frameStep = Math.max(
        1,
        Math.round(frameRate / Math.min(WEBP_TARGET_FRAME_RATE, frameRate))
      );
      const frames: Array<{ chunks: Uint8Array; duration: number }> = [];
      for (let frame = 0; frame < totalFrames; frame += frameStep) {
        throwIfAborted();
        await options.renderFrame(frame, output, true);
        frames.push({
          chunks: await encodeCanvasWebP(output),
          duration: Math.round((1000 * frameStep) / frameRate),
        });
        options.onProgress({
          completedFrames: Math.min(frame + frameStep, totalFrames),
          totalFrames,
        });
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }
      const webpBytes = assembleAnimatedWebP({
        width: output.width,
        height: output.height,
        frames,
      });
      const webpBuffer = new ArrayBuffer(webpBytes.byteLength);
      new Uint8Array(webpBuffer).set(webpBytes);
      await saveBlob(
        new Blob([webpBuffer], { type: "image/webp" }),
        `${safeFileName(options.projectName)}.webp`,
        options.destination,
        options.destinationPort
      );
      return;
    }
    if (typeof MediaRecorder === "undefined" || !output.captureStream) {
      throw new Error("이 브라우저는 영상 출력을 지원하지 않습니다.");
    }
    throwIfAborted();
    const audioClips = buildProjectExportAudioClips({
      project: options.project,
      exportGroupLayerDocumentId: options.exportGroupLayerDocumentId,
      durationFrames: totalFrames,
      frameRate,
      resolveAudioResource: options.resolveAudioResource,
    });
    const mimeType = videoType(options.format, audioClips.length > 0);
    if (!mimeType) {
      throw new Error("이 브라우저는 선택한 영상 형식을 지원하지 않습니다.");
    }
    const audioMix = await createProjectExportAudioMix(audioClips);
    const video = await recordProjectVideo({
      output,
      mimeType,
      frameRate,
      totalFrames,
      transparent: options.format === "webm-alpha",
      audioMix,
      renderFrame: options.renderFrame,
      onProgress: options.onProgress,
      signal: options.signal,
    });
    throwIfAborted();
    await saveBlob(
      video,
      `${safeFileName(options.projectName)}.${projectVideoExtension(options.format)}`,
      options.destination,
      options.destinationPort
    );
  }
}
