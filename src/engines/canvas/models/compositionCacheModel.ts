import type {
  CompositionPreviewNode,
  PreviewCompositionCacheKeyInput,
  PreviewCompositionCachePort,
  PreviewRenderSurface,
} from "@/engines/playback-render";

export type CompositionPreviewCacheKeyInput = PreviewCompositionCacheKeyInput;

export type CompositionPreviewCacheEntry = {
  readonly key: string;
  readonly node: CompositionPreviewNode;
  readonly surface: PreviewRenderSurface;
};

export type CompositionPreviewCacheSnapshot = {
  readonly size: number;
  readonly disposed: boolean;
  readonly keys: readonly string[];
};

export type CompositionPreviewCacheRuntime = PreviewCompositionCachePort & {
  readonly beginFrame: () => void;
  readonly endFrame: () => void;
  readonly dispose: () => void;
  readonly getSnapshot: () => CompositionPreviewCacheSnapshot;
};

export type CompositionPreviewCacheRuntimeOptions = {
  readonly releaseSurface?: (surface: PreviewRenderSurface) => void;
};
