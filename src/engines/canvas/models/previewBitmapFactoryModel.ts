import type { RenderSize } from "@/engines/playback-render";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";
import type {
  PreviewBitmapImage,
  PreviewGeneration,
  PreviewRuntimeResource,
} from "@/engines/canvas/models/previewRuntimeModel";

export type PreviewBitmapFactoryInput = {
  readonly key: string;
  readonly generation: PreviewGeneration;
  readonly sourceId: string;
  readonly sourceFingerprint: string | null;
  readonly quality: ResolvedPreviewQuality;
  readonly sourceCanvas: HTMLCanvasElement;
  readonly logicalSize: RenderSize;
};

export type PreviewBitmapCreationAdapter = {
  readonly createBitmap: (
    sourceCanvas: HTMLCanvasElement,
    pixelSize: RenderSize
  ) => Promise<PreviewBitmapImage | null>;
  readonly createFallbackBitmap: (
    sourceCanvas: HTMLCanvasElement,
    pixelSize: RenderSize
  ) => PreviewBitmapImage;
  readonly disposeBitmap: (bitmap: PreviewBitmapImage) => void;
};

export type PreviewBitmapFactoryErrorCode =
  | "invalid-source-size"
  | "source-resource-reused"
  | "bitmap-creation-failed";

export type PreviewBitmapFactoryError = {
  readonly code: PreviewBitmapFactoryErrorCode;
  readonly message: string;
  readonly cause?: unknown;
};

export type PreviewBitmapFactoryResult =
  | {
      readonly ok: true;
      readonly resource: PreviewRuntimeResource;
    }
  | {
      readonly ok: false;
      readonly error: PreviewBitmapFactoryError;
    };
