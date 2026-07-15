import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  Composition,
  CompositionMeta,
  Layer,
  Position,
  PropertyTrackState,
  Scale,
} from "@/editor/types/types";
import type {
  PreviewOverlay as PreviewOverlayData,
  ScaleHandleDirection,
} from "@/editor/types/editorViewTypes";
import type { TransformEditMode } from "@/editor/types/transformActionTypes";
import type { TransformTargetSelection } from "@/features/preview/types/previewControllerTypes";
import { usePreviewAnchorInteraction } from "@/features/preview/interaction/usePreviewAnchorInteraction";
import { usePreviewHandleInteractions } from "@/features/preview/interaction/usePreviewHandleInteractions";

type UsePreviewTransformInteractionsOptions = {
  masterCompId: string;
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
  selectedTransformLocalFrame: number;
  selectedPropertyState: PropertyTrackState;
  playheadFrame: number;
  resolvedPositionDraft: Position;
  resolvedOpacityDraft: number;
  allLayersById: Map<string, Layer>;
  allCompositionsById: Map<string, Composition>;
  metaByCompId: Record<string, CompositionMeta>;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setPositionDraft: Dispatch<SetStateAction<Position | null>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
  setIsDraggingAnchor: Dispatch<SetStateAction<boolean>>;
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

export function usePreviewTransformInteractions({
  masterCompId,
  previewOverlayRef,
  selectedMeta,
  previewSize,
  previewZoom,
  previewViewportOffset,
  selectedPreviewOverlay,
  selectedTransformTarget,
  selectedTimelineTargetItem,
  selectedTransformLocalFrame,
  selectedPropertyState,
  playheadFrame,
  resolvedPositionDraft,
  resolvedOpacityDraft,
  allLayersById,
  allCompositionsById,
  metaByCompId,
  setComps,
  setPositionDraft,
  setScaleDraft,
  setRotationDraft,
  setOpacityDraft,
  setIsDraggingAnchor,
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
}: UsePreviewTransformInteractionsOptions) {
  const anchorInteraction = usePreviewAnchorInteraction({
    masterCompId,
    previewOverlayRef,
    selectedMeta,
    previewSize,
    previewZoom,
    previewViewportOffset,
    selectedPreviewOverlay,
    selectedTransformLocalFrame,
    playheadFrame,
    allLayersById,
    allCompositionsById,
    metaByCompId,
    setComps,
    setIsDraggingAnchor,
    beginTransformHistoryCapture,
    markTransformHistoryCaptureDirty,
    commitTransformHistoryCapture,
  });

  const handleInteractions = usePreviewHandleInteractions({
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
  });

  return {
    ...handleInteractions,
    ...anchorInteraction,
  };
}
