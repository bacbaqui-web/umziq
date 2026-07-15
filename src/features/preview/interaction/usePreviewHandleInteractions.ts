import type { Dispatch, RefObject, SetStateAction } from "react";
import type { CompositionMeta, Position, PropertyTrackState, Scale } from "@/editor/types/types";
import type {
  PreviewOverlay as PreviewOverlayData,
  ScaleHandleDirection,
} from "@/editor/types/editorViewTypes";
import type { TransformEditMode } from "@/editor/types/transformActionTypes";
import type { TransformTargetSelection } from "@/features/preview/types/previewControllerTypes";
import { usePreviewDirectMoveInteraction } from "@/features/preview/interaction/usePreviewDirectMoveInteraction";
import { getPreviewHandleEditModes } from "@/features/preview/interaction/previewHandleEditModes";
import { usePreviewOpacityInteraction } from "@/features/preview/interaction/usePreviewOpacityInteraction";
import { usePreviewRotationInteraction } from "@/features/preview/interaction/usePreviewRotationInteraction";
import { usePreviewScaleInteraction } from "@/features/preview/interaction/usePreviewScaleInteraction";

type UsePreviewHandleInteractionsOptions = {
  previewOverlayRef: RefObject<HTMLDivElement | null>;
  selectedMeta: CompositionMeta | null;
  previewSize: {
    width: number;
    height: number;
  };
  previewZoom: number;
  previewViewportOffset: Position;
  selectedPreviewOverlay: PreviewOverlayData;
  selectedTransformTarget: TransformTargetSelection;
  selectedTimelineTargetItem: {
    startFrame: number;
  } | null;
  selectedPropertyState: PropertyTrackState;
  playheadFrame: number;
  resolvedPositionDraft: Position;
  resolvedOpacityDraft: number;
  setPositionDraft: Dispatch<SetStateAction<Position | null>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
  setIsDraggingPosition: Dispatch<SetStateAction<boolean>>;
  setIsDraggingOpacity: Dispatch<SetStateAction<boolean>>;
  setIsDraggingRotation: Dispatch<SetStateAction<boolean>>;
  setPositionHandleReadout: Dispatch<SetStateAction<string | null>>;
  setOpacityHandleReadout: Dispatch<SetStateAction<string | null>>;
  setScaleHandleReadout: Dispatch<
    SetStateAction<{
      handle: ScaleHandleDirection;
      text: string;
    } | null>
  >;
  setRotationHandleReadout: Dispatch<SetStateAction<string | null>>;
  pushTransformHistorySnapshot: () => void;
  beginTransformHistoryCapture: () => void;
  markTransformHistoryCaptureDirty: () => void;
  commitTransformHistoryCapture: () => void;
  applyPositionValue: (nextPosition: Position, editMode: TransformEditMode) => void;
  applyScaleValue: (nextScale: Scale, editMode: TransformEditMode) => void;
  applyRotationValue: (nextRotation: number, editMode: TransformEditMode) => void;
  applyOpacityValue: (nextOpacity: number, editMode: TransformEditMode) => void;
};

export function usePreviewHandleInteractions({
  previewOverlayRef,
  selectedMeta,
  previewSize,
  previewZoom,
  previewViewportOffset,
  selectedPreviewOverlay,
  selectedTransformTarget,
  selectedTimelineTargetItem,
  selectedPropertyState,
  playheadFrame,
  resolvedPositionDraft,
  resolvedOpacityDraft,
  setPositionDraft,
  setScaleDraft,
  setRotationDraft,
  setOpacityDraft,
  setIsDraggingPosition,
  setIsDraggingOpacity,
  setIsDraggingRotation,
  setPositionHandleReadout,
  setOpacityHandleReadout,
  setScaleHandleReadout,
  setRotationHandleReadout,
  pushTransformHistorySnapshot,
  beginTransformHistoryCapture,
  markTransformHistoryCaptureDirty,
  commitTransformHistoryCapture,
  applyPositionValue,
  applyScaleValue,
  applyRotationValue,
  applyOpacityValue,
}: UsePreviewHandleInteractionsOptions) {
  const editModes = getPreviewHandleEditModes(selectedPropertyState);

  const { startPreviewPositionDrag, onTargetMouseDown } = usePreviewDirectMoveInteraction({
    previewOverlayRef,
    selectedMeta,
    previewSize,
    previewZoom,
    previewViewportOffset,
    selectedPreviewOverlay,
    selectedTransformTarget,
    selectedTimelineTargetItem,
    playheadFrame,
    resolvedPositionDraft,
    positionEditMode: editModes.position,
    setPositionDraft,
    setIsDraggingPosition,
    setPositionHandleReadout,
    pushTransformHistorySnapshot,
    beginTransformHistoryCapture,
    markTransformHistoryCaptureDirty,
    commitTransformHistoryCapture,
    applyPositionValue,
  });

  const { startPreviewScaleDrag } = usePreviewScaleInteraction({
    previewOverlayRef,
    selectedMeta,
    previewSize,
    previewZoom,
    previewViewportOffset,
    selectedPreviewOverlay,
    scaleEditMode: editModes.scale,
    setScaleDraft,
    setScaleHandleReadout,
    beginTransformHistoryCapture,
    markTransformHistoryCaptureDirty,
    commitTransformHistoryCapture,
    applyScaleValue,
  });

  const { startPreviewRotationDrag } = usePreviewRotationInteraction({
    previewOverlayRef,
    selectedMeta,
    previewSize,
    previewZoom,
    previewViewportOffset,
    selectedPreviewOverlay,
    rotationEditMode: editModes.rotation,
    setRotationDraft,
    setIsDraggingRotation,
    setRotationHandleReadout,
    beginTransformHistoryCapture,
    markTransformHistoryCaptureDirty,
    commitTransformHistoryCapture,
    applyRotationValue,
  });

  const { startPreviewOpacityDrag } = usePreviewOpacityInteraction({
    previewOverlayRef,
    selectedMeta,
    previewSize,
    previewZoom,
    previewViewportOffset,
    selectedPreviewOverlay,
    resolvedOpacityDraft,
    opacityEditMode: editModes.opacity,
    setOpacityDraft,
    setIsDraggingOpacity,
    setOpacityHandleReadout,
    beginTransformHistoryCapture,
    markTransformHistoryCaptureDirty,
    commitTransformHistoryCapture,
    applyOpacityValue,
  });

  return {
    startPreviewScaleDrag,
    startPreviewPositionDrag,
    startPreviewOpacityDrag,
    startPreviewRotationDrag,
    onTargetMouseDown,
  };
}
