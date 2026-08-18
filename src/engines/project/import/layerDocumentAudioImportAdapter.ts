import type {
  AudioLayerDocument,
  AudioSourceRecord,
  LayerDocumentCommon,
  LayerDocumentProject,
  LinkedSourceContentFingerprint,
} from "@/models";
import type { ImportSourceRegistryCommand } from "@/engines/project/models/layerDocumentSourcePreparationModel";
import type {
  LayerDocumentAudioRuntimeResource,
  LayerDocumentDecodedAudioMetadata,
} from "@/engines/project/models/layerDocumentAudioRuntimeModel";
import {
  createLayerDocumentPreparedRuntimeLifecycle,
  type LayerDocumentPreparedRuntimeLifecycle,
} from "@/engines/project/import/layerDocumentPreparedRuntimeLifecycle";

export interface PreparedLayerDocumentAudioImport {
  readonly file: File;
  readonly command: ImportSourceRegistryCommand;
  readonly sourceId: string;
  readonly layerDocumentId: string;
  readonly reusedSource: boolean;
  readonly runtime: LayerDocumentPreparedRuntimeLifecycle<LayerDocumentAudioRuntimeResource>;
}

export interface LayerDocumentAudioDecodePort {
  readonly decode: (buffer: ArrayBuffer) => Promise<{
    readonly decodedAudio: unknown;
    readonly metadata: LayerDocumentDecodedAudioMetadata;
    readonly dispose?: () => void;
  }>;
}

function stableId(prefix: string, token: string, key: string) {
  return `${prefix}:${`${token}:${key}`.toLowerCase().replace(/[^a-z0-9:_-]+/g, "-")}`;
}

async function fingerprint(buffer: ArrayBuffer): Promise<LinkedSourceContentFingerprint> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return {
    algorithm: "sha-256",
    digestHex: Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    byteLength: buffer.byteLength,
  };
}

function common(options: {
  parentLayerDocumentId: string;
  order: number;
  sourceId: string;
  durationFrames: number;
}): LayerDocumentCommon<{ sourceId: string }> {
  return {
    source: { sourceId: options.sourceId },
    transform: {
      position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 },
      anchor: { x: 0, y: 0 }, scale: { x: 100, y: 100 },
      scaleLinked: true, rotation: 0, opacity: 100,
    },
    placement: {
      parentLayerDocumentId: options.parentLayerDocumentId,
      order: options.order, startFrame: 0,
      durationFrames: options.durationFrames, sourceOffsetFrames: 0,
      visible: true, alias: null,
    },
    animation: {
      positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [],
      enabledProperties: { position: false, scale: false, rotation: false, opacity: false },
    },
    effects: [], modifiers: [],
  };
}

export function resolveLayerDocumentAudioImportCut(options: {
  project: LayerDocumentProject;
  explicitCutLayerDocumentId?: string | null;
  selectedLayerDocumentId?: string | null;
  activeGroupLayerDocumentId?: string | null;
}): string | null {
  const resolve = (start: string | null | undefined) => {
    let id = start ?? null;
    const visited = new Set<string>();
    while (id && !visited.has(id)) {
      visited.add(id);
      const layer = options.project.payload.layerDocumentsById[id];
      if (!layer) return null;
      if (layer.type === "group") return layer.layerDocumentId;
      id = layer.common.placement.parentLayerDocumentId;
    }
    return null;
  };
  const explicit = resolve(options.explicitCutLayerDocumentId);
  if (options.explicitCutLayerDocumentId !== undefined) return explicit;
  const selected = resolve(options.selectedLayerDocumentId);
  if (selected) return selected;
  if (options.selectedLayerDocumentId) return null;
  return Object.values(options.project.payload.layerDocumentsById)
    .find((layer) => layer.type === "group" && layer.data.role === "project-root")
    ?.layerDocumentId ?? null;
}

export const LAYER_DOCUMENT_BROWSER_AUDIO_DECODER: LayerDocumentAudioDecodePort = {
  decode: async (buffer) => {
    const Constructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Constructor) throw new Error("This browser cannot decode Audio files");
    const context = new Constructor();
    try {
      const decoded = await context.decodeAudioData(buffer.slice(0));
      return {
        decodedAudio: decoded,
        metadata: {
          durationSeconds: decoded.duration,
          channelCount: decoded.numberOfChannels,
          sampleRate: decoded.sampleRate,
        },
      };
    } finally {
      await context.close();
    }
  },
};

export async function prepareLayerDocumentAudioImport(options: {
  project: LayerDocumentProject;
  file: File;
  token: string;
  explicitCutLayerDocumentId?: string | null;
  selectedLayerDocumentId?: string | null;
  activeGroupLayerDocumentId?: string | null;
  order?: number;
  decoder?: LayerDocumentAudioDecodePort;
  provenance?: "imported" | "recorded";
  relativePathHint?: string | null;
  reuseMatchingSource?: boolean;
}): Promise<PreparedLayerDocumentAudioImport> {
  const mimeType = options.file.type.toLowerCase();
  const hasAudioExtension = /\.(wav|mp3|m4a|aac|ogg|oga|webm|flac)$/i
    .test(options.file.name);
  if (!mimeType.startsWith("audio/") && !(mimeType === "" && hasAudioExtension)) {
    throw new Error("Choose a browser-decodable audio/* file");
  }
  const cutId = resolveLayerDocumentAudioImportCut(options);
  if (!cutId) throw new Error("오디오를 넣을 그룹을 선택한 뒤 다시 시도해주세요.");
  const cut = options.project.payload.layerDocumentsById[cutId];
  if (!cut || cut.type !== "group") throw new Error("Audio import Group not found");
  const buffer = await options.file.arrayBuffer();
  const [decoded, contentFingerprint] = await Promise.all([
    (options.decoder ?? LAYER_DOCUMENT_BROWSER_AUDIO_DECODER).decode(buffer),
    fingerprint(buffer),
  ]);
  if (
    !Number.isFinite(decoded.metadata.durationSeconds) ||
    decoded.metadata.durationSeconds <= 0 ||
    !Number.isInteger(decoded.metadata.channelCount) || decoded.metadata.channelCount < 1 ||
    !Number.isInteger(decoded.metadata.sampleRate) || decoded.metadata.sampleRate < 1
  ) {
    decoded.dispose?.();
    throw new Error("Decoded Audio metadata is invalid");
  }
  const shared = options.reuseMatchingSource === false
    ? undefined
    : Object.values(options.project.payload.sourceRegistry.sourcesById)
      .find((source) => source.kind === "audio" &&
        source.data.provenance === (options.provenance ?? "imported") &&
        source.contentFingerprint?.digestHex === contentFingerprint.digestHex &&
        source.contentFingerprint.byteLength === contentFingerprint.byteLength);
  const sourceId = shared?.sourceId ?? stableId(
    options.provenance === "recorded" ? "recorded-audio-source" : "audio-source",
    options.token,
    options.file.name
  );
  const layerDocumentId = stableId("audio-layer", options.token, cutId);
  const durationFrames = Math.max(1, Math.ceil(
    decoded.metadata.durationSeconds * cut.data.frameRate
  ));
  const source: AudioSourceRecord = {
    sourceId, kind: "audio", displayName: options.file.name,
    version: 1, refresh: { status: "normal" },
    locator: {
      locatorId: `linked:${sourceId}`, kind: "linked-file",
      suggestedFileName: options.file.name, relativePathHint: options.relativePathHint ?? null,
    },
    contentFingerprint,
    data: {
      mimeType: options.file.type || null, durationFrames,
      channelCount: decoded.metadata.channelCount,
      sampleRate: decoded.metadata.sampleRate,
      provenance: options.provenance ?? "imported",
    },
  };
  const siblingCount = Object.values(options.project.payload.layerDocumentsById)
    .filter((layer) => layer.common.placement.parentLayerDocumentId === cutId).length;
  const layer: AudioLayerDocument = {
    layerDocumentId, revision: 0,
    name: options.file.name.replace(/\.[^.]+$/, ""), type: "audio",
    common: common({
      parentLayerDocumentId: cutId, order: options.order ?? siblingCount,
      sourceId, durationFrames,
    }),
    data: { gain: 1, muted: false, fadeInFrames: 0, fadeOutFrames: 0 },
  };
  const runtimeResource: LayerDocumentAudioRuntimeResource = {
    sourceId, fingerprint: contentFingerprint.digestHex,
    decodedAudio: decoded.decodedAudio, metadata: decoded.metadata,
    dispose: decoded.dispose,
  };
  return {
    file: options.file, sourceId, layerDocumentId,
    reusedSource: Boolean(shared),
    command: {
      sources: shared ? [] : [source], layers: [layer],
      parentDurationExtensions: [{
        layerDocumentId: cutId,
        durationFrames: Math.max(cut.data.durationFrames, durationFrames),
      }],
      selectSourceId: sourceId, selectLayerDocumentId: layerDocumentId,
    },
    runtime: createLayerDocumentPreparedRuntimeLifecycle([runtimeResource]),
  };
}

declare global {
  interface Window { webkitAudioContext?: typeof AudioContext; }
  var webkitAudioContext: typeof AudioContext | undefined;
}
