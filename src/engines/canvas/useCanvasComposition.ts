import type { ComponentProps, Dispatch, SetStateAction } from "react";
import type {
  Composition,
  CompositionMeta,
  Layer,
  Position,
  PropertyTrackState,
  Scale,
  TimelineItem,
  TimelineSelection,
} from "@/models";
import type { RenderItem } from "@/engines/project";
import type { TransformEditMode, TransformTargetSelection } from "@/engines/animation";
import { useRenderEngine } from "@/engines/playback-render";
import { useCanvasEngine } from "@/engines/canvas/useCanvasEngine";
import type { CanvasInteractionStatePort } from "@/engines/canvas/models/canvasInteractionModel";
import type { ScaleHandleDirection } from "@/engines/canvas/models/canvasViewModel";
import type PreviewWorkspacePane from "@/features/preview/components/PreviewWorkspacePane";

export type UseCanvasCompositionOptions = {
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
  previewWorkspaceSize: { width: number; height: number };
  previewZoom: number;
  previewPan: Position;
  showShortformFrameOverlay: boolean;
  showSafeZoneGuides: boolean;
  resolvedPositionDraft: Position;
  resolvedScaleDraft: Scale;
  resolvedRotationDraft: number;
  resolvedOpacityDraft: number;
  allLayersById: Map<string, Layer>;
  allCompositionsById: Map<string, Composition>;
  metaByCompId: Record<string, CompositionMeta>;
  renderItemsByCompId: Record<string, RenderItem[]>;
  seekFrame: (frame: number) => void;
  setPositionDraft: Dispatch<SetStateAction<Position | null>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
  setPreviewWorkspaceSize: Dispatch<SetStateAction<{ width: number; height: number }>>;
  setPreviewZoom: Dispatch<SetStateAction<number>>;
  setPreviewPan: Dispatch<SetStateAction<Position>>;
  setShowShortformFrameOverlay: Dispatch<SetStateAction<boolean>>;
  setShowSafeZoneGuides: Dispatch<SetStateAction<boolean>>;
  isPreviewPanning: boolean;
  isPreviewPanModifierActive: boolean;
  setIsPreviewPanning: Dispatch<SetStateAction<boolean>>;
  setIsPreviewPanModifierActive: Dispatch<SetStateAction<boolean>>;
  interactionState: CanvasInteractionStatePort;
  history: { push: () => void; begin: () => void; markDirty: () => void; commit: () => void; cancel: () => void };
  applySelectionForComposition: (compId: string, selection: TimelineSelection) => void;
  animation: {
    applyPosition: (value: Position, mode: TransformEditMode) => void;
    applyScale: (value: Scale, mode: TransformEditMode) => void;
    applyRotation: (value: number, mode: TransformEditMode) => void;
    applyOpacity: (value: number, mode: TransformEditMode) => void;
    applyAnchor: (command: { target: { kind: "layer" | "composition"; id: string }; anchor: Position; transformOffset: Position }) => void;
    upsertPropertyKeyframe: (command: { target: { kind: "layer" | "composition"; id: string }; property: "position" | "scale" | "rotation" | "opacity"; frame: number; value: Position | Scale | number }) => void;
    selectPropertyKeyframe: (target: { kind: "layer" | "composition"; id: string }, property: "position" | "scale" | "rotation" | "opacity", frame: number) => void;
    commitScaleInput: (handle: ScaleHandleDirection, value: number) => void;
    commitRotationInput: (value: number) => void;
    commitOpacityInput: (value: number) => void;
  };
};

export function useCanvasComposition(options: UseCanvasCompositionOptions) {
  const renderEngine = useRenderEngine({
    masterCompId: options.masterCompId,
    sceneCompositions: options.comps,
    selectedComp: options.selectedComp,
    selectedMeta: options.selectedMeta,
    selectedTimelineItems: options.selectedTimelineItems,
    globalFrame: options.playheadFrame,
    layerMap: options.allLayersById,
    compositionMap: options.allCompositionsById,
    metaByCompId: options.metaByCompId,
    renderItemsByCompId: options.renderItemsByCompId,
  });
  const canvasEngine = useCanvasEngine({
    minWorkspaceWidth: options.previewMinWorkspaceWidth,
    minWorkspaceHeight: options.previewMinWorkspaceHeight,
    shortformFrameWidth: options.shortformFrameWidth,
    shortformFrameHeight: options.shortformFrameHeight,
    project: { selectedCompId: options.selectedComp.id, selectedMeta: options.selectedMeta },
    state: {
      previewWorkspaceSize: options.previewWorkspaceSize,
      setPreviewWorkspaceSize: options.setPreviewWorkspaceSize,
      previewZoom: options.previewZoom,
      setPreviewZoom: options.setPreviewZoom,
      previewPan: options.previewPan,
      setPreviewPan: options.setPreviewPan,
      showShortformFrameOverlay: options.showShortformFrameOverlay,
      setShowShortformFrameOverlay: options.setShowShortformFrameOverlay,
      showSafeZoneGuides: options.showSafeZoneGuides,
      setShowSafeZoneGuides: options.setShowSafeZoneGuides,
    },
    panState: {
      setIsPreviewPanning: options.setIsPreviewPanning,
      setIsPreviewPanModifierActive: options.setIsPreviewPanModifierActive,
    },
    render: { frame: renderEngine.renderFrame, items: renderEngine.renderItems, localFrameBySourceId: renderEngine.localFrameBySourceId },
    selection: { target: options.selectedTransformTarget, timelineItems: options.selectedTimelineItems, playheadFrame: options.playheadFrame, metaByCompId: options.metaByCompId },
    interaction: {
      masterCompId: options.masterCompId,
      selectedTimelineTargetItem: options.selectedTimelineTargetItem,
      selectedTransformLocalFrame: options.selectedTransformLocalFrame,
      selectedPropertyState: options.selectedPropertyState,
      resolvedPosition: options.resolvedPositionDraft,
      resolvedScale: options.resolvedScaleDraft,
      resolvedRotation: options.resolvedRotationDraft,
      resolvedOpacity: options.resolvedOpacityDraft,
      allLayersById: options.allLayersById,
      allCompositionsById: options.allCompositionsById,
      state: options.interactionState,
      seekFrame: options.seekFrame,
      drafts: { setPosition: options.setPositionDraft, setScale: options.setScaleDraft, setRotation: options.setRotationDraft, setOpacity: options.setOpacityDraft },
      history: options.history,
      commands: {
        applyPosition: options.animation.applyPosition,
        applyScale: options.animation.applyScale,
        applyRotation: options.animation.applyRotation,
        applyOpacity: options.animation.applyOpacity,
        applyAnchor: options.animation.applyAnchor,
        upsertPositionKeyframe: options.animation.upsertPropertyKeyframe,
        selectPositionKeyframe: options.animation.selectPropertyKeyframe,
        applySelection: options.applySelectionForComposition,
        commitScaleInput: options.animation.commitScaleInput,
        commitRotationInput: options.animation.commitRotationInput,
        commitOpacityInput: options.animation.commitOpacityInput,
      },
    },
  });

  const viewProps: ComponentProps<typeof PreviewWorkspacePane> = {
    selectedComp: options.selectedComp,
    selectedMeta: options.selectedMeta,
    previewWorkspaceRef: canvasEngine.refs.workspaceRef,
    previewViewportRef: canvasEngine.refs.viewportRef,
    previewCanvasRef: canvasEngine.refs.canvasRef,
    previewOverlayRef: canvasEngine.refs.overlayRef,
    previewBaseOffset: canvasEngine.viewport.previewBaseOffset,
    previewPan: options.previewPan,
    previewZoom: options.previewZoom,
    previewZoomPercent: canvasEngine.viewport.previewZoomPercent,
    previewSize: canvasEngine.viewport.previewSize,
    previewViewportWidth: canvasEngine.viewport.previewViewportWidth,
    previewViewportHeight: canvasEngine.viewport.previewViewportHeight,
    guide: canvasEngine.guide,
    toggleShortformFrame: canvasEngine.guideCommands.toggleShortformFrame,
    toggleSafeZone: canvasEngine.guideCommands.toggleSafeZone,
    resetPreviewView: canvasEngine.viewportCommands.resetViewport,
    setOneToOnePreviewView: canvasEngine.viewportCommands.setActualSize,
    centerPreviewView: canvasEngine.viewportCommands.centerViewport,
    handlePreviewViewportWheel: canvasEngine.viewportInteractions.handleWheel,
    handlePreviewViewportMouseDownCapture: canvasEngine.viewportInteractions.handleMouseDownCapture,
    isPreviewPanning: options.isPreviewPanning,
    isPreviewPanModifierActive: options.isPreviewPanModifierActive,
    interactionViewModel: canvasEngine.interaction.viewModel,
    interactionCommands: canvasEngine.interaction.commands,
  };

  return { viewProps, canvasEngine, renderEngine };
}
