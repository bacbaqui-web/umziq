import type {
  Composition,
  CompositionMeta,
  Layer,
  TimelineItem,
} from "@/models";
import type { RenderItem } from "@/engines/project";
import {
  buildEvaluatedScene,
  buildEvaluatedSceneFromItems,
} from "@/engines/playback-render/helpers/evaluatedSceneHelpers";
import type { EvaluatedScene } from "@/engines/playback-render/models/evaluatedSceneModel";
import type { RenderFrame } from "@/engines/playback-render/models/renderFrameModel";
import type { RenderDrawableSourceResolver } from "@/engines/playback-render/models/renderSourceModel";
import type { RendererMode } from "@/engines/playback-render/models/rendererModeModel";
import { renderWithRendererMode } from "@/engines/playback-render/renderers/rendererMode";

type BuildRenderFrameOptions = {
  compositionId: string;
  width: number;
  height: number;
  renderItems: readonly RenderItem[];
  timelineItems: readonly TimelineItem[];
  layerMap: ReadonlyMap<string, Layer>;
  compositionMap: ReadonlyMap<string, Composition>;
  metaByCompId: Record<string, CompositionMeta>;
  globalFrame: number;
  frameRate?: number;
  resolveDrawableSource?: RenderDrawableSourceResolver;
  rendererMode?: RendererMode;
};

type BuildRenderFrameFromItemsOptions = Omit<
  BuildRenderFrameOptions,
  "timelineItems"
> & {
  localFrameBySourceId: ReadonlyMap<string, number>;
};

type BuildRenderFrameFromEvaluatedSceneOptions = {
  evaluatedScene: EvaluatedScene;
  renderItems: readonly RenderItem[];
  resolveDrawableSource?: RenderDrawableSourceResolver;
  rendererMode?: RendererMode;
};

export function buildRenderFrameFromEvaluatedScene({
  evaluatedScene,
  renderItems,
  resolveDrawableSource,
  rendererMode = "full-render",
}: BuildRenderFrameFromEvaluatedSceneOptions): RenderFrame {
  const result = renderWithRendererMode({
    mode: rendererMode,
    evaluatedScene,
    renderItems,
    resolveDrawableSource,
  });

  if (result.mode !== "full-render") {
    throw new Error("Fast Preview Renderer does not produce a RenderFrame");
  }

  return result.frame;
}

export function buildRenderFrameFromItems(
  options: BuildRenderFrameFromItemsOptions
): RenderFrame {
  const evaluatedScene = buildEvaluatedSceneFromItems(options);
  return buildRenderFrameFromEvaluatedScene({
    evaluatedScene,
    renderItems: options.renderItems,
    resolveDrawableSource: options.resolveDrawableSource,
    rendererMode: options.rendererMode,
  });
}

export function buildRenderFrame(options: BuildRenderFrameOptions) {
  const evaluatedScene = buildEvaluatedScene(options);
  return buildRenderFrameFromEvaluatedScene({
    evaluatedScene,
    renderItems: options.renderItems,
    resolveDrawableSource: options.resolveDrawableSource,
    rendererMode: options.rendererMode,
  });
}
