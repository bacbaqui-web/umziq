import type { RenderItem } from "@/engines/project";
import type { EvaluatedScene } from "@/engines/playback-render/models/evaluatedSceneModel";
import type { PreviewScene } from "@/engines/playback-render/models/previewSceneModel";
import type { RenderFrame } from "@/engines/playback-render/models/renderFrameModel";
import type { RenderDrawableSourceResolver } from "@/engines/playback-render/models/renderSourceModel";
import type { RuntimeMetricRecordPort } from "@/engines/playback-render/models/runtimeMetricPortModel";

export type RendererMode = "full-render" | "fast-render";

export type RenderAccurateFrameOptions = {
  evaluatedScene: EvaluatedScene;
  renderItems: readonly RenderItem[];
  resolveDrawableSource?: RenderDrawableSourceResolver;
  runtimeMetrics?: RuntimeMetricRecordPort;
};

export type AccurateRendererResult = {
  mode: "full-render";
  frame: RenderFrame;
};

export type FastPreviewRendererResult = {
  mode: "fast-render";
  previewScene: PreviewScene;
};

export type RendererModeResult =
  | AccurateRendererResult
  | FastPreviewRendererResult;

export type RenderWithRendererModeOptions = RenderAccurateFrameOptions & {
  mode: RendererMode;
  previousPreviewScene?: PreviewScene | null;
};
