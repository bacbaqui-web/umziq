import type { EvaluatedScene } from "@/engines/playback-render/models/evaluatedSceneModel";
import type { PreviewScene } from "@/engines/playback-render/models/previewSceneModel";
import type { RenderFrame } from "@/engines/playback-render/models/renderFrameModel";
import type {
  RenderNodeVisualResolver,
} from "@/engines/playback-render/models/renderSourceModel";
import type { RuntimeMetricRecordPort } from "@/engines/playback-render/models/runtimeMetricPortModel";

export type RenderAccurateFrameOptions = {
  evaluatedScene: EvaluatedScene;
  resolveNodeVisual?: RenderNodeVisualResolver;
  runtimeMetrics?: RuntimeMetricRecordPort;
};

export type AccurateRendererResult = {
  frame: RenderFrame;
};

export type PreviewRendererResult = {
  previewScene: PreviewScene;
};
