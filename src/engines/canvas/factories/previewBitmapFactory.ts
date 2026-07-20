import { previewBitmapBrowserAdapter } from "@/engines/canvas/adapters/previewBitmapBrowserAdapter";
import { estimatePreviewSourceMemory } from "@/engines/canvas/helpers/previewMemoryHelpers";
import type {
  PreviewBitmapCreationAdapter,
  PreviewBitmapFactoryInput,
  PreviewBitmapFactoryResult,
} from "@/engines/canvas/models/previewBitmapFactoryModel";
import type { PreviewBitmapImage } from "@/engines/canvas/models/previewRuntimeModel";

function createDispose(
  bitmap: PreviewBitmapImage,
  adapter: PreviewBitmapCreationAdapter
): () => void {
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    adapter.disposeBitmap(bitmap);
  };
}

export async function createPreviewBitmapResource(
  input: PreviewBitmapFactoryInput,
  adapter: PreviewBitmapCreationAdapter = previewBitmapBrowserAdapter
): Promise<PreviewBitmapFactoryResult> {
  const sourceEstimate = estimatePreviewSourceMemory(
    {
      sourceId: input.sourceId,
      sourcePixelSize: {
        width: input.sourceCanvas.width,
        height: input.sourceCanvas.height,
      },
    },
    input.quality
  );
  const pixelSize = sourceEstimate.scaledPixelSize;

  if (pixelSize.width === 0 || pixelSize.height === 0) {
    return {
      ok: false,
      error: {
        code: "invalid-source-size",
        message: "Preview bitmap source size must be greater than zero",
      },
    };
  }

  try {
    const createdBitmap = await adapter.createBitmap(
      input.sourceCanvas,
      pixelSize
    );
    const bitmap =
      createdBitmap ??
      adapter.createFallbackBitmap(input.sourceCanvas, pixelSize);

    if (bitmap === input.sourceCanvas) {
      return {
        ok: false,
        error: {
          code: "source-resource-reused",
          message: "Preview bitmap must not reuse the original source canvas",
        },
      };
    }

    return {
      ok: true,
      resource: {
        key: input.key,
        generation: input.generation,
        sourceId: input.sourceId,
        sourceFingerprint: input.sourceFingerprint,
        quality: input.quality,
        estimatedBytes: sourceEstimate.estimatedBytes,
        allocatedBytes: pixelSize.width * pixelSize.height * 4,
        bitmap: {
          image: bitmap,
          pixelSize: { ...pixelSize },
          logicalSize: { ...input.logicalSize },
          dispose: createDispose(bitmap, adapter),
        },
      },
    };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: "bitmap-creation-failed",
        message: "Preview bitmap could not be created",
        cause,
      },
    };
  }
}
