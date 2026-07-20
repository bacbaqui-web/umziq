import type {
  RendererModeResult,
  RenderWithRendererModeOptions,
} from "@/engines/playback-render/models/rendererModeModel";
import { renderAccurateRenderer } from "@/engines/playback-render/renderers/accurateRenderer";
import { renderFastPreviewRenderer } from "@/engines/playback-render/renderers/fastPreviewRenderer";

export function renderWithRendererMode(
  options: RenderWithRendererModeOptions
): RendererModeResult {
  if (options.mode === "fast-render") {
    return renderFastPreviewRenderer(
      options.evaluatedScene,
      options.runtimeMetrics,
      options.previousPreviewScene
    );
  }

  return renderAccurateRenderer(options);
}
