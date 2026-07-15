import { useEffect, type RefObject } from "react";
import { drawRenderItems } from "@/editor/preview/previewRenderer";
import type {
  Composition,
  CompositionMeta,
  Layer,
  RenderItem,
} from "@/editor/types/types";

type UsePreviewCanvasRendererOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  selectedMeta: CompositionMeta | null;
  activeRenderItems: RenderItem[];
  allLayersById: Map<string, Layer>;
  allCompositionsById: Map<string, Composition>;
  metaByCompId: Record<string, CompositionMeta>;
  playheadFrame: number;
  localFrameBySourceId: Map<string, number>;
};

export function usePreviewCanvasRenderer({
  canvasRef,
  selectedMeta,
  activeRenderItems,
  allLayersById,
  allCompositionsById,
  metaByCompId,
  playheadFrame,
  localFrameBySourceId,
}: UsePreviewCanvasRendererOptions) {
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !selectedMeta) {
      return;
    }

    canvas.width = selectedMeta.width;
    canvas.height = selectedMeta.height;
    drawRenderItems(
      canvas,
      selectedMeta.width,
      selectedMeta.height,
      activeRenderItems,
      allLayersById,
      allCompositionsById,
      metaByCompId,
      playheadFrame,
      localFrameBySourceId
    );
  }, [
    activeRenderItems,
    allCompositionsById,
    allLayersById,
    canvasRef,
    localFrameBySourceId,
    metaByCompId,
    playheadFrame,
    selectedMeta,
  ]);
}
