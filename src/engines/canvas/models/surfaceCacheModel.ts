import type {
  PreviewRenderSurface,
  PreviewRenderSurfaceFactory,
} from "@/render";

export type PreviewSurfaceCacheKeyInput = {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly previewQuality: string;
  readonly previewScale: number;
};

export type PreviewSurfaceCacheAcquireInput = PreviewSurfaceCacheKeyInput & {
  readonly createSurface: PreviewRenderSurfaceFactory;
};

export type PreviewSurfaceCacheSnapshot = {
  readonly activeCount: number;
  readonly poolSize: number;
  readonly disposed: boolean;
  readonly keys: readonly string[];
};

export type PreviewSurfaceCacheRuntime = {
  readonly acquireSurface: (
    input: PreviewSurfaceCacheAcquireInput
  ) => PreviewRenderSurface | null;
  readonly releaseSurface: (surface: PreviewRenderSurface) => void;
  readonly disposeSurface: (surface: PreviewRenderSurface) => void;
  readonly dispose: () => void;
  readonly getSnapshot: () => PreviewSurfaceCacheSnapshot;
};
