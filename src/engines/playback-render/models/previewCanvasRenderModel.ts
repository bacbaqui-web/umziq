import type { Canvas2DRenderContext } from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import type {
  CompositionPreviewNode,
  PreviewScene,
} from "@/engines/playback-render/models/previewSceneModel";

export type PreviewNodeBounds = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

export type PreviewRenderSurface = {
  canvas: HTMLCanvasElement;
  context: Canvas2DRenderContext;
};

export type PreviewCanvasDrawState = {
  previousScene: PreviewScene | null;
  previousNodeBoundsById: ReadonlyMap<string, PreviewNodeBounds>;
  previousPixelScale: number | null;
};

export type PreviewRenderSurfaceFactory = (
  logicalWidth: number,
  logicalHeight: number,
  pixelScale: number
) => PreviewRenderSurface | null;

export type PreviewCompositionCacheKeyInput = {
  readonly node: CompositionPreviewNode;
  readonly previewQuality: string;
  readonly previewScale: number;
  readonly rendererMode: "fast-render";
  readonly runtimeId?: string;
};

export type PreviewCompositionCachePort = {
  readonly getSurface: (
    input: PreviewCompositionCacheKeyInput
  ) => PreviewRenderSurface | null;
  readonly storeSurface: (
    input: PreviewCompositionCacheKeyInput,
    surface: PreviewRenderSurface
  ) => void;
};

export type PreviewSurfaceCacheAcquireInput = {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly previewQuality: string;
  readonly previewScale: number;
  readonly createSurface: PreviewRenderSurfaceFactory;
};

export type PreviewSurfaceCachePort = {
  readonly acquireSurface: (
    input: PreviewSurfaceCacheAcquireInput
  ) => PreviewRenderSurface | null;
  readonly releaseSurface: (surface: PreviewRenderSurface) => void;
};
