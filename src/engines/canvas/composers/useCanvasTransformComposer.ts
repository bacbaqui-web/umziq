import { useCanvasAnchorTransformController } from "@/engines/canvas/controllers/useCanvasAnchorTransformController";
import { useCanvasArrowNudgeController } from "@/engines/canvas/controllers/useCanvasArrowNudgeController";
import { useCanvasOpacityDragController } from "@/engines/canvas/controllers/useCanvasOpacityDragController";
import { useCanvasPositionDragController } from "@/engines/canvas/controllers/useCanvasPositionDragController";
import { useCanvasRotationDragController } from "@/engines/canvas/controllers/useCanvasRotationDragController";
import { useCanvasScaleDragController } from "@/engines/canvas/controllers/useCanvasScaleDragController";
import { useCanvasTransformDraftController } from "@/engines/canvas/controllers/useCanvasTransformDraftController";
import type { PreviewPointerContext } from "@/engines/canvas/helpers/canvasPointerHelpers";
import type { UseCanvasTransformControllerOptions } from "@/engines/canvas/models/canvasTransformControllerModel";

export function useCanvasTransformComposer(
  options: UseCanvasTransformControllerOptions
) {
  const getPointerContext = (
    clientX: number,
    clientY: number
  ): PreviewPointerContext | null => {
    const bounds = options.overlayRef.current?.getBoundingClientRect();
    if (!bounds || !options.selectedMeta) return null;
    return {
      overlayBounds: bounds,
      selectedMeta: options.selectedMeta,
      previewSize: options.previewSize,
      previewZoom: options.previewZoom,
      previewViewportOffset: options.previewViewportOffset,
      clientX,
      clientY,
    };
  };

  const draftRuntime = useCanvasTransformDraftController(options);
  const startPositionDrag = useCanvasPositionDragController(
    options,
    getPointerContext,
    draftRuntime
  );
  const startScaleDrag = useCanvasScaleDragController(
    options,
    getPointerContext,
    draftRuntime
  );
  const startRotationDrag = useCanvasRotationDragController(
    options,
    getPointerContext,
    draftRuntime
  );
  const startOpacityDrag = useCanvasOpacityDragController(
    options,
    getPointerContext,
    draftRuntime
  );
  const anchor = useCanvasAnchorTransformController(
    options,
    getPointerContext,
    draftRuntime
  );
  useCanvasArrowNudgeController(options);

  return {
    startPositionDrag,
    startScaleDrag,
    startRotationDrag,
    startOpacityDrag,
    startAnchorDrag: anchor.startAnchorDrag,
    updateAnchorDraft: anchor.updateAnchorDraft,
    resetDraftRuntime: draftRuntime.reset,
  };
}
