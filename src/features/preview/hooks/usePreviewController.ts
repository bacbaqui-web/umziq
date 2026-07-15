import { useRef, type Dispatch, type SetStateAction } from "react";
import type {
  Composition,
  CompositionMeta,
  Layer,
  Position,
  PropertyTrackState,
  RenderItem,
  Scale,
  TimelineItem,
} from "@/editor/types/types";
import type {
  SelectedKeyframe,
  TimelineSelection,
  ScaleHandleDirection,
} from "@/editor/types/editorViewTypes";
import type { TransformEditMode } from "@/editor/types/transformActionTypes";
import type { TransformTargetSelection } from "@/features/preview/types/previewControllerTypes";
import { usePreviewCanvasRenderer } from "@/features/preview/hooks/usePreviewCanvasRenderer";
import { usePreviewMotionPathInteractions } from "@/features/preview/interaction/usePreviewMotionPathInteractions";
import { usePreviewSceneGeometry } from "@/features/preview/hooks/usePreviewSceneGeometry";
import { usePreviewTransformInteractions } from "@/features/preview/interaction/usePreviewTransformInteractions";
import { usePreviewViewport } from "@/features/preview/hooks/usePreviewViewport";

type UsePreviewControllerOptions = {
  masterCompId: string;
  previewMinWorkspaceWidth: number;
  previewMinWorkspaceHeight: number;
  shortformFrameWidth: number;
  shortformFrameHeight: number;
  comps: Composition[];
  selectedComp: Composition;
  selectedMeta: CompositionMeta | null;
  selectedTransformTarget: TransformTargetSelection;
  selectedTimelineTargetItem: TimelineItem | null;
  selectedTimelineItems: TimelineItem[];
  playheadFrame: number;
  selectedTransformLocalFrame: number;
  selectedPropertyState: PropertyTrackState;
  previewWorkspaceSize: {
    width: number;
    height: number;
  };
  previewZoom: number;
  previewPan: Position;
  resolvedPositionDraft: Position;
  resolvedOpacityDraft: number;
  allLayersById: Map<string, Layer>;
  allCompositionsById: Map<string, Composition>;
  metaByCompId: Record<string, CompositionMeta>;
  renderItemsByCompId: Record<string, RenderItem[]>;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setCurrentFrame: Dispatch<SetStateAction<number>>;
  setPositionDraft: Dispatch<SetStateAction<Position | null>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  setPreviewWorkspaceSize: Dispatch<
    SetStateAction<{
      width: number;
      height: number;
    }>
  >;
  setPreviewZoom: Dispatch<SetStateAction<number>>;
  setPreviewPan: Dispatch<SetStateAction<Position>>;
  setIsDraggingAnchor: Dispatch<SetStateAction<boolean>>;
  setIsDraggingPosition: Dispatch<SetStateAction<boolean>>;
  setIsDraggingMotionPathKeyframe: Dispatch<SetStateAction<boolean>>;
  setIsDraggingOpacity: Dispatch<SetStateAction<boolean>>;
  setIsDraggingRotation: Dispatch<SetStateAction<boolean>>;
  setIsPreviewPanning: Dispatch<SetStateAction<boolean>>;
  setIsPreviewPanModifierActive: Dispatch<SetStateAction<boolean>>;
  setPositionHandleReadout: Dispatch<SetStateAction<string | null>>;
  setMotionPathKeyframeReadout: Dispatch<SetStateAction<string | null>>;
  setDraggingMotionPathFrame: Dispatch<SetStateAction<number | null>>;
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
  applySelectionForComposition: (compId: string, nextSelection: TimelineSelection) => void;
  applyPositionValue: (nextPosition: Position, editMode: TransformEditMode) => void;
  applyScaleValue: (nextScale: Scale, editMode: TransformEditMode) => void;
  applyRotationValue: (nextRotation: number, editMode: TransformEditMode) => void;
  applyOpacityValue: (nextOpacity: number, editMode: TransformEditMode) => void;
  commitPreviewScaleInput: (handle: ScaleHandleDirection, value: number) => void;
  commitPreviewRotationInput: (value: number) => void;
  commitPreviewOpacityInput: (value: number) => void;
};

export function usePreviewController({
  masterCompId,
  previewMinWorkspaceWidth,
  previewMinWorkspaceHeight,
  shortformFrameWidth,
  shortformFrameHeight,
  comps,
  selectedComp,
  selectedMeta,
  selectedTransformTarget,
  selectedTimelineTargetItem,
  selectedTimelineItems,
  playheadFrame,
  selectedTransformLocalFrame,
  selectedPropertyState,
  previewWorkspaceSize,
  previewZoom,
  previewPan,
  resolvedPositionDraft,
  resolvedOpacityDraft,
  allLayersById,
  allCompositionsById,
  metaByCompId,
  renderItemsByCompId,
  setComps,
  setCurrentFrame,
  setPositionDraft,
  setScaleDraft,
  setRotationDraft,
  setOpacityDraft,
  setSelectedKeyframe,
  setPreviewWorkspaceSize,
  setPreviewZoom,
  setPreviewPan,
  setIsDraggingAnchor,
  setIsDraggingPosition,
  setIsDraggingMotionPathKeyframe,
  setIsDraggingOpacity,
  setIsDraggingRotation,
  setIsPreviewPanning,
  setIsPreviewPanModifierActive,
  setPositionHandleReadout,
  setMotionPathKeyframeReadout,
  setDraggingMotionPathFrame,
  setOpacityHandleReadout,
  setScaleHandleReadout,
  setRotationHandleReadout,
  pushTransformHistorySnapshot,
  beginTransformHistoryCapture,
  markTransformHistoryCaptureDirty,
  commitTransformHistoryCapture,
  applySelectionForComposition,
  applyPositionValue,
  applyScaleValue,
  applyRotationValue,
  applyOpacityValue,
  commitPreviewScaleInput,
  commitPreviewRotationInput,
  commitPreviewOpacityInput,
}: UsePreviewControllerOptions) {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewOverlayRef = useRef<HTMLDivElement | null>(null);

  const {
    previewViewportRef,
    previewWorkspaceRef,
    previewViewportWidth,
    previewViewportHeight,
    previewFitZoom,
    previewSize,
    previewBaseOffset,
    previewViewportOffset,
    previewZoomPercent,
    guideGeometry,
    resetPreviewView,
    centerPreviewView,
    setOneToOnePreviewView,
    handlePreviewViewportWheel,
    handlePreviewViewportMouseDownCapture,
  } = usePreviewViewport({
    previewMinWorkspaceWidth,
    previewMinWorkspaceHeight,
    shortformFrameWidth,
    shortformFrameHeight,
    selectedCompId: selectedComp.id,
    selectedMeta,
    previewWorkspaceSize,
    previewZoom,
    previewPan,
    setPreviewWorkspaceSize,
    setPreviewZoom,
    setPreviewPan,
    setIsPreviewPanning,
    setIsPreviewPanModifierActive,
  });

  const {
    activeRenderItems,
    localFrameBySourceId,
    selectedPreviewOverlay,
    selectedPreviewMotionPath,
  } = usePreviewSceneGeometry({
    masterCompId,
    comps,
    selectedComp,
    selectedMeta,
    selectedTransformTarget,
    selectedTimelineItems,
    playheadFrame,
    metaByCompId,
    renderItemsByCompId,
  });

  usePreviewCanvasRenderer({
    canvasRef: previewCanvasRef,
    selectedMeta,
    activeRenderItems,
    allLayersById,
    allCompositionsById,
    metaByCompId,
    playheadFrame,
    localFrameBySourceId,
  });

  const {
    startPreviewScaleDrag,
    startPreviewPositionDrag,
    startPreviewOpacityDrag,
    startPreviewRotationDrag,
    onTargetMouseDown,
    onAnchorMouseDown,
  } = usePreviewTransformInteractions({
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
  });

  const {
    handleSelectMotionPathFrame,
    handleStartMotionPathKeyframeDrag,
  } = usePreviewMotionPathInteractions({
    previewOverlayRef,
    selectedMeta,
    previewSize,
    previewZoom,
    previewViewportOffset,
    selectedCompId: selectedComp.id,
    selectedTransformTarget,
    selectedTimelineTargetItem,
    setComps,
    setCurrentFrame,
    setPositionDraft,
    setScaleDraft,
    setRotationDraft,
    setOpacityDraft,
    setSelectedKeyframe,
    setIsDraggingMotionPathKeyframe,
    setMotionPathKeyframeReadout,
    setDraggingMotionPathFrame,
    applySelectionForComposition,
  });

  return {
    previewCanvasRef,
    previewOverlayRef,
    previewViewportRef,
    previewWorkspaceRef,
    previewViewportWidth,
    previewViewportHeight,
    previewFitZoom,
    previewSize,
    previewBaseOffset,
    previewViewportOffset,
    previewZoomPercent,
    guideGeometry,
    selectedPreviewOverlay,
    selectedPreviewMotionPath,
    resetPreviewView,
    centerPreviewView,
    setOneToOnePreviewView,
    handlePreviewViewportWheel,
    handlePreviewViewportMouseDownCapture,
    startPreviewScaleDrag,
    startPreviewPositionDrag,
    startPreviewOpacityDrag,
    startPreviewRotationDrag,
    onTargetMouseDown,
    onAnchorMouseDown,
    handleSelectMotionPathFrame,
    handleStartMotionPathKeyframeDrag,
    commitPreviewScaleInput,
    commitPreviewRotationInput,
    commitPreviewOpacityInput,
  };
}
