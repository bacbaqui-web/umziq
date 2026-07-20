import type { RenderSize } from "@/engines/playback-render";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";

export type PreviewBitmapImage =
  | ImageBitmap
  | HTMLCanvasElement
  | OffscreenCanvas;

export type PreviewGeneration = number;

export type PreviewBitmapRuntime = {
  readonly image: PreviewBitmapImage;
  readonly pixelSize: RenderSize;
  readonly logicalSize: RenderSize;
  readonly dispose: () => void;
};

export type PreviewRuntimeResource = {
  readonly key: string;
  readonly generation: PreviewGeneration;
  readonly sourceId: string;
  readonly sourceFingerprint: string | null;
  readonly quality: ResolvedPreviewQuality;
  readonly estimatedBytes: number;
  readonly allocatedBytes: number;
  readonly bitmap: PreviewBitmapRuntime;
};
