import type { EvaluatedScene } from "@/render/models/evaluatedSceneModel";
import type { PreviewScene } from "@/render/models/previewSceneModel";
import type { RenderFrame } from "@/render/models/renderFrameModel";
import type {
  RenderNodeVisualResolver,
} from "@/render/models/renderSourceModel";
import type { RuntimeMetricRecordPort } from "@/render/models/runtimeMetricPortModel";

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
