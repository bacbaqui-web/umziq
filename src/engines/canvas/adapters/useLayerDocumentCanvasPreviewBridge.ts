import {
  useEffect,
  type RefObject,
} from "react";
import {
  useLayerDocumentCanvasOverlayAdapter,
} from "@/engines/canvas/adapters/useLayerDocumentCanvasOverlayAdapter";
import {
  useLayerDocumentCanvasInteractionAdapter,
} from "@/engines/canvas/adapters/useLayerDocumentCanvasInteractionAdapter";
import {
  useLayerDocumentCanvasDirectSelectionController,
} from "@/engines/canvas/controllers/useLayerDocumentCanvasDirectSelectionController";
import {
  useCanvasPointerController,
} from "@/engines/canvas/controllers/useCanvasPointerController";
import type {
  CanvasInteractionStatePort,
} from "@/engines/canvas/models/canvasInteractionModel";
import type {
  LayerDocumentCanvasCommands,
  LayerDocumentCanvasReadModel,
} from "@/engines/canvas/models/layerDocumentCanvasReadModel";

/**
 * The concrete bridge to the existing PreviewWorkspacePane contract.
 * It creates no Store/Runtime authority; all Draft/commit operations remain
 * delegated to the supplied LayerDocument command port.
 */
export function useLayerDocumentCanvasPreviewBridge<
  TCommitResult,
  TSelectionResult,
  TKeyframeResult,
>(options: {
  overlayRef: RefObject<HTMLDivElement | null>;
  readModel: LayerDocumentCanvasReadModel;
  commands: LayerDocumentCanvasCommands<
    TCommitResult,
    TSelectionResult,
    TKeyframeResult
  >;
  state: CanvasInteractionStatePort;
  isGlowEnabled: boolean;
  viewportSize: { width: number; height: number };
  resetRevision?: number;
}) {
  const pointer = useCanvasPointerController();
  const cancelPointer = pointer.cancel;
  useEffect(() => {
    if (options.resetRevision === undefined) return;
    cancelPointer();
  }, [cancelPointer, options.resetRevision]);
  const interaction =
    useLayerDocumentCanvasInteractionAdapter({
      overlayRef: options.overlayRef,
      readModel: options.readModel,
      commands: options.commands,
      state: options.state,
      pointer,
    });
  const direct =
    useLayerDocumentCanvasDirectSelectionController({
      overlayRef: options.overlayRef,
      readModel: options.readModel,
      commands: options.commands,
      isGlowEnabled: options.isGlowEnabled,
      isTransformDragging:
        options.readModel
          .hoverSuppressedDuringTransform,
      viewportSize: options.viewportSize,
      startPositionDrag:
        interaction.transform.startPositionDrag,
    });
  const overlay =
    useLayerDocumentCanvasOverlayAdapter({
      readModel: options.readModel,
      state: options.state,
      transform: interaction.transform,
      pressTarget: direct.pressTarget,
      motion: interaction.motion,
      directInput: interaction.directInput,
    });
  return {
    previewWorkspaceScene:
      options.readModel.previewWorkspaceScene,
    renderer: options.readModel.renderer,
    interactionViewModel: overlay.viewModel,
    interactionCommands: overlay.commands,
    directSelectionHover: direct.hover,
    selectionGlow: direct.glow,
  };
}
