import { useCallback, useEffect } from "react";
import { usePreviewController } from "@/features/preview/hooks/usePreviewController";
import { useTimelineController } from "@/features/timeline/hooks/useTimelineController";
import {
  buildTimelineCompositionSwitcherModel,
  buildTimelineSelectionPath,
} from "@/features/timeline/timelineSelectionPath";
import { formatCompactTime, formatTimelineTime } from "@/editor/preview/previewEngine";
import { getTransformEditMode } from "@/editor/types/transformActionTypes";
import { useEditorPropertyModel } from "@/editor/state/useEditorPropertyModel";
import { useProjectActions } from "@/editor/actions/useProjectActions";
import { useTransformActions } from "@/editor/actions/useTransformActions";
import { useEditorShellLayout } from "@/editor/useEditorShellLayout";
import {
  ANIMATABLE_PROPERTIES,
  DEFAULT_FRAME_RATE,
  MASTER_COMP_ID,
  MASTER_DEFAULT_HEIGHT,
  MASTER_DEFAULT_WIDTH,
  PREVIEW_MIN_WORKSPACE_HEIGHT,
  PREVIEW_MIN_WORKSPACE_WIDTH,
  PROPERTY_LABELS,
  SHORTFORM_FRAME_HEIGHT,
  SHORTFORM_FRAME_WIDTH,
  TIMELINE_NAME_COL_WIDTH,
  TIMELINE_PX_PER_FRAME,
} from "@/editor/editorShellConstants";
import type { EditorShellLayoutProps } from "@/editor/EditorShellLayout";
import type { useEditorShellModels } from "@/editor/useEditorShellModels";

type EditorShellModels = ReturnType<typeof useEditorShellModels>;

export function useEditorShellFeatures({
  editorState,
  selectionModel,
}: EditorShellModels): EditorShellLayoutProps {
  const {
    enterComposition,
    handleImportPsdFiles,
    handleRefreshMainComp,
    handleDeleteMainComp,
    handleReorderMainComps,
    handleAcknowledgeTimelineSourceStatus,
    handleResolveTimelineSourceDelete,
  } = useProjectActions({
    masterCompId: MASTER_COMP_ID,
    masterWidth: MASTER_DEFAULT_WIDTH,
    masterHeight: MASTER_DEFAULT_HEIGHT,
    comps: editorState.comps,
    metaByCompId: editorState.metaByCompId,
    timelineItemsByCompId: editorState.timelineItemsByCompId,
    renderItemsByCompId: editorState.renderItemsByCompId,
    masterEnabledProperties: editorState.masterEnabledProperties,
    selectedCompId: editorState.selectedCompId,
    lastSelectedItemByCompId: editorState.lastSelectedItemByCompId,
    nextImportIndex: editorState.nextImportIndex,
    psdSourceEntriesRef: editorState.psdSourceEntriesRef,
    setComps: editorState.setComps,
    setMetaByCompId: editorState.setMetaByCompId,
    setTimelineItemsByCompId: editorState.setTimelineItemsByCompId,
    setRenderItemsByCompId: editorState.setRenderItemsByCompId,
    setSelectedCompId: editorState.setSelectedCompId,
    setNextImportIndex: editorState.setNextImportIndex,
    setImportError: editorState.setImportError,
    setImportNotice: editorState.setImportNotice,
    pushCompositionHistorySnapshot: editorState.pushCompositionHistorySnapshot,
    clearAllCompositionHistories: editorState.clearAllCompositionHistories,
    applySelectionForComposition: editorState.applySelectionForComposition,
  });

  const { startPanelResize } = useEditorShellLayout({
    leftPanelWidth: editorState.leftPanelWidth,
    rightPanelWidth: editorState.rightPanelWidth,
    setLeftPanelWidth: editorState.setLeftPanelWidth,
    setRightPanelWidth: editorState.setRightPanelWidth,
    setTimelinePanelHeight: editorState.setTimelinePanelHeight,
    activePanelResize: editorState.activePanelResize,
    setActivePanelResize: editorState.setActivePanelResize,
    isDraggingAnchor: editorState.isDraggingAnchor,
    isDraggingPosition: editorState.isDraggingPosition,
    isDraggingMotionPathKeyframe: editorState.isDraggingMotionPathKeyframe,
    isDraggingRotation: editorState.isDraggingRotation,
    isPreviewPanning: editorState.isPreviewPanning,
  });

  const timelinePlaybackRange = (() => {
    const selectedComp = selectionModel.selectedComp;
    const selectedMeta = selectionModel.selectedMeta;

    if (!selectedComp || !selectedMeta) {
      return { startFrame: 0, endFrame: 0 };
    }

    const storedRange = editorState.playbackRangeByCompId[selectedComp.id];
    const defaultPlaybackRangeEndFrame = Math.min(
      selectedMeta.durationFrames,
      Math.max(selectedMeta.frameRate * 4, 1)
    );
    const clampedStartFrame = Math.min(
      Math.max(storedRange?.startFrame ?? 0, 0),
      Math.max(selectedMeta.durationFrames - 1, 0)
    );
    const clampedEndFrame = Math.min(
      Math.max(
        storedRange?.endFrame ?? defaultPlaybackRangeEndFrame,
        clampedStartFrame + 1
      ),
      selectedMeta.durationFrames
    );

    return {
      startFrame: clampedStartFrame,
      endFrame: clampedEndFrame,
    };
  })();

  const timelineController = useTimelineController({
    masterCompId: MASTER_COMP_ID,
    timelinePxPerFrame: TIMELINE_PX_PER_FRAME,
    selectedComp: selectionModel.selectedComp,
    selectedMeta: selectionModel.selectedMeta,
    playbackRangeStartFrame: timelinePlaybackRange.startFrame,
    playbackRangeEndFrame: timelinePlaybackRange.endFrame,
    comps: editorState.comps,
    currentFrame: editorState.currentFrame,
    hoveredFrame: editorState.hoveredFrame,
    draggedTimelineItemId: editorState.draggedTimelineItemId,
    draggingKeyframe: editorState.draggingKeyframe,
    selectedTimelineTarget: editorState.selectedTimelineTarget,
    selectedTimelineItems: selectionModel.selectedTimelineItems,
    renderItemsByCompId: editorState.renderItemsByCompId,
    setComps: editorState.setComps,
    setSelectedCompId: editorState.setSelectedCompId,
    setTimelineItemsByCompId: editorState.setTimelineItemsByCompId,
    setRenderItemsByCompId: editorState.setRenderItemsByCompId,
    setCurrentFrame: editorState.setCurrentFrame,
    setSelectedKeyframe: editorState.setSelectedKeyframe,
    setDraggingKeyframe: editorState.setDraggingKeyframe,
    setDraggedTimelineItemId: editorState.setDraggedTimelineItemId,
    setIsScrubbingTimeline: editorState.setIsScrubbingTimeline,
    setIsPlaying: editorState.setIsPlaying,
    isPlaying: editorState.isPlaying,
    pushCompositionHistorySnapshot: editorState.pushCompositionHistorySnapshot,
    beginCompositionHistoryCapture: editorState.beginCompositionHistoryCapture,
    markCompositionHistoryCaptureDirty: editorState.markCompositionHistoryCaptureDirty,
    commitCompositionHistoryCapture: editorState.commitCompositionHistoryCapture,
    setPositionDraft: editorState.setPositionDraft,
    setScaleDraft: editorState.setScaleDraft,
    setRotationDraft: editorState.setRotationDraft,
    setOpacityDraft: editorState.setOpacityDraft,
    applySelectionForComposition: editorState.applySelectionForComposition,
  });

  const propertyModel = useEditorPropertyModel({
    selectedTransformTarget: selectionModel.selectedTransformTarget,
    selectedLayer: selectionModel.selectedLayer,
    selectedTimelineComp: selectionModel.selectedTimelineComp,
    playheadFrame: timelineController.playheadFrame,
    selectedTransformLocalFrame: timelineController.selectedTransformLocalFrame,
    positionDraft: editorState.positionDraft,
    scaleDraft: editorState.scaleDraft,
    rotationDraft: editorState.rotationDraft,
    opacityDraft: editorState.opacityDraft,
  });

  const transformActions = useTransformActions({
    masterCompId: MASTER_COMP_ID,
    selectedComp: selectionModel.selectedComp,
    selectedLayer: selectionModel.selectedLayer,
    selectedTimelineComp: selectionModel.selectedTimelineComp,
    selectedTransformTarget: selectionModel.selectedTransformTarget,
    selectedScaleTarget: selectionModel.selectedScaleTarget,
    selectedScaleLinked: selectionModel.selectedScaleLinked,
    selectedPropertyState: selectionModel.selectedPropertyState,
    selectedTransformLocalFrame: timelineController.selectedTransformLocalFrame,
    playheadFrame: timelineController.playheadFrame,
    resolvedPositionDraft: propertyModel.resolvedPositionDraft,
    resolvedScaleDraft: propertyModel.resolvedScaleDraft,
    resolvedRotationDraft: propertyModel.resolvedRotationDraft,
    resolvedOpacityDraft: propertyModel.resolvedOpacityDraft,
    selectedKeyframe: editorState.selectedKeyframe,
    setComps: editorState.setComps,
    setMasterScale: editorState.setMasterScale,
    setMasterScaleKeyframes: editorState.setMasterScaleKeyframes,
    setMasterScaleLinked: editorState.setMasterScaleLinked,
    setMasterRotation: editorState.setMasterRotation,
    setMasterRotationKeyframes: editorState.setMasterRotationKeyframes,
    setMasterOpacity: editorState.setMasterOpacity,
    setMasterOpacityKeyframes: editorState.setMasterOpacityKeyframes,
    setMasterEnabledProperties: editorState.setMasterEnabledProperties,
    setSelectedKeyframe: editorState.setSelectedKeyframe,
    setScaleDraft: editorState.setScaleDraft,
    setRotationDraft: editorState.setRotationDraft,
    setOpacityDraft: editorState.setOpacityDraft,
  });

  const pushSelectedCompositionHistorySnapshot = useCallback(() => {
    const selectedCompId = selectionModel.selectedComp?.id;

    if (!selectedCompId) {
      return;
    }

    editorState.pushCompositionHistorySnapshot(selectedCompId);
  }, [editorState, selectionModel.selectedComp?.id]);

  const beginSelectedCompositionHistoryCapture = useCallback(() => {
    const selectedCompId = selectionModel.selectedComp?.id;

    if (!selectedCompId) {
      return;
    }

    editorState.beginCompositionHistoryCapture(selectedCompId);
  }, [editorState, selectionModel.selectedComp?.id]);

  const markSelectedCompositionHistoryCaptureDirty = useCallback(() => {
    const selectedCompId = selectionModel.selectedComp?.id;

    if (!selectedCompId) {
      return;
    }

    editorState.markCompositionHistoryCaptureDirty(selectedCompId);
  }, [editorState, selectionModel.selectedComp?.id]);

  const commitSelectedCompositionHistoryCapture = useCallback(() => {
    const selectedCompId = selectionModel.selectedComp?.id;

    if (!selectedCompId) {
      return;
    }

    editorState.commitCompositionHistoryCapture(selectedCompId);
  }, [editorState, selectionModel.selectedComp?.id]);

  const previewController = usePreviewController({
    masterCompId: MASTER_COMP_ID,
    previewMinWorkspaceWidth: PREVIEW_MIN_WORKSPACE_WIDTH,
    previewMinWorkspaceHeight: PREVIEW_MIN_WORKSPACE_HEIGHT,
    shortformFrameWidth: SHORTFORM_FRAME_WIDTH,
    shortformFrameHeight: SHORTFORM_FRAME_HEIGHT,
    comps: editorState.comps,
    selectedComp: selectionModel.selectedComp,
    selectedMeta: selectionModel.selectedMeta,
    selectedTransformTarget: selectionModel.selectedTransformTarget,
    selectedTimelineTargetItem: timelineController.selectedTimelineTargetItem,
    selectedTimelineItems: selectionModel.selectedTimelineItems,
    playheadFrame: timelineController.playheadFrame,
    selectedTransformLocalFrame: timelineController.selectedTransformLocalFrame,
    selectedPropertyState: selectionModel.selectedPropertyState,
    previewWorkspaceSize: editorState.previewWorkspaceSize,
    previewZoom: editorState.previewZoom,
    previewPan: editorState.previewPan,
    resolvedPositionDraft: propertyModel.resolvedPositionDraft,
    resolvedOpacityDraft: propertyModel.resolvedOpacityDraft,
    allLayersById: selectionModel.allLayersById,
    allCompositionsById: selectionModel.allCompositionsById,
    metaByCompId: editorState.metaByCompId,
    renderItemsByCompId: editorState.renderItemsByCompId,
    setComps: editorState.setComps,
    setCurrentFrame: editorState.setCurrentFrame,
    setPositionDraft: editorState.setPositionDraft,
    setScaleDraft: editorState.setScaleDraft,
    setRotationDraft: editorState.setRotationDraft,
    setOpacityDraft: editorState.setOpacityDraft,
    setSelectedKeyframe: editorState.setSelectedKeyframe,
    setPreviewWorkspaceSize: editorState.setPreviewWorkspaceSize,
    setPreviewZoom: editorState.setPreviewZoom,
    setPreviewPan: editorState.setPreviewPan,
    setIsDraggingAnchor: editorState.setIsDraggingAnchor,
    setIsDraggingPosition: editorState.setIsDraggingPosition,
    setIsDraggingMotionPathKeyframe: editorState.setIsDraggingMotionPathKeyframe,
    setIsDraggingOpacity: editorState.setIsDraggingOpacity,
    setIsDraggingRotation: editorState.setIsDraggingRotation,
    setIsPreviewPanning: editorState.setIsPreviewPanning,
    setIsPreviewPanModifierActive: editorState.setIsPreviewPanModifierActive,
    setPositionHandleReadout: editorState.setPositionHandleReadout,
    setMotionPathKeyframeReadout: editorState.setMotionPathKeyframeReadout,
    setDraggingMotionPathFrame: editorState.setDraggingMotionPathFrame,
    setOpacityHandleReadout: editorState.setOpacityHandleReadout,
    setScaleHandleReadout: editorState.setScaleHandleReadout,
    setRotationHandleReadout: editorState.setRotationHandleReadout,
    pushTransformHistorySnapshot: pushSelectedCompositionHistorySnapshot,
    beginTransformHistoryCapture: beginSelectedCompositionHistoryCapture,
    markTransformHistoryCaptureDirty: markSelectedCompositionHistoryCaptureDirty,
    commitTransformHistoryCapture: commitSelectedCompositionHistoryCapture,
    applySelectionForComposition: editorState.applySelectionForComposition,
    applyPositionValue: transformActions.applyPositionValue,
    applyScaleValue: transformActions.applyScaleValue,
    applyRotationValue: transformActions.applyRotationValue,
    applyOpacityValue: transformActions.applyOpacityValue,
    commitPreviewScaleInput: transformActions.commitPreviewScaleInput,
    commitPreviewRotationInput: transformActions.commitPreviewRotationInput,
    commitPreviewOpacityInput: transformActions.commitPreviewOpacityInput,
  });

  const timelineSelectionBreadcrumbPath = buildTimelineSelectionPath(
    selectionModel.selectedComp,
    editorState.selectedTimelineTarget,
    selectionModel.allLayersById,
    selectionModel.allCompositionsById
  );
  const timelineCompositionSwitcher = buildTimelineCompositionSwitcherModel(
    selectionModel.selectedComp,
    selectionModel.allCompositionsById
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isUndoRedoKey =
        event.code === "KeyZ" || event.key.toLowerCase() === "z";

      if (!(event.metaKey || event.ctrlKey) || event.altKey || !isUndoRedoKey) {
        return;
      }

      const activeElement = document.activeElement;
      const isTypingTarget =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable);

      if (isTypingTarget) {
        return;
      }

      event.preventDefault();

      const selectedCompId = selectionModel.selectedComp?.id;

      if (!selectedCompId) {
        return;
      }

      if (event.shiftKey) {
        editorState.redoCompositionHistory(selectedCompId);
        return;
      }

      editorState.undoCompositionHistory(selectedCompId);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editorState, selectionModel.selectedComp]);

  useEffect(() => {
    if (!editorState.isPlaying || !selectionModel.selectedMeta) return;

    const playbackRangeStartFrame = timelinePlaybackRange.startFrame;
    const playbackRangeEndFrame = timelinePlaybackRange.endFrame;
    const playbackStopFrame = Math.max(
      playbackRangeStartFrame,
      Math.min(playbackRangeEndFrame - 1, selectionModel.selectedMeta.durationFrames - 1)
    );

    const intervalId = window.setInterval(() => {
      editorState.setPositionDraft(null);
      editorState.setScaleDraft(null);
      editorState.setRotationDraft(null);
      editorState.setOpacityDraft(null);
      editorState.setCurrentFrame((prev) => {
        if (prev < playbackRangeStartFrame || prev >= playbackRangeEndFrame) {
          return playbackRangeStartFrame;
        }

        const nextFrame = prev + 1;

        if (
          nextFrame >= selectionModel.selectedMeta.durationFrames ||
          nextFrame >= playbackRangeEndFrame
        ) {
          window.clearInterval(intervalId);
          editorState.setIsPlaying(false);
          return playbackStopFrame;
        }

        return nextFrame;
      });
    }, 1000 / selectionModel.selectedMeta.frameRate);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    editorState,
    selectionModel.selectedMeta,
    timelinePlaybackRange.endFrame,
    timelinePlaybackRange.startFrame,
  ]);

  return {
    leftPanelWidth: editorState.leftPanelWidth,
    rightPanelWidth: editorState.rightPanelWidth,
    timelinePanelHeight: editorState.timelinePanelHeight,
    activePanelResize: editorState.activePanelResize,
    onStartLeftResize: (clientX, clientY) =>
      startPanelResize("left", clientX, clientY, editorState.leftPanelWidth),
    onStartRightResize: (clientX, clientY) =>
      startPanelResize("right", clientX, clientY, editorState.rightPanelWidth),
    onStartBottomResize: (clientX, clientY) =>
      startPanelResize("bottom", clientX, clientY, editorState.timelinePanelHeight),
    psdTreeProps: {
      comps: selectionModel.rootComps,
      selectedCompId: editorState.selectedCompId,
      onSelectComp: (comp) => {
        enterComposition(comp.id);
      },
      onImportPsdFiles: handleImportPsdFiles,
      onRefreshMainComp: handleRefreshMainComp,
      onDeleteMainComp: handleDeleteMainComp,
      onReorderMainComps: handleReorderMainComps,
    },
    previewPaneProps: {
      selectedComp: selectionModel.selectedComp,
      selectedMeta: selectionModel.selectedMeta,
      previewWorkspaceRef: previewController.previewWorkspaceRef,
      previewViewportRef: previewController.previewViewportRef,
      previewCanvasRef: previewController.previewCanvasRef,
      previewOverlayRef: previewController.previewOverlayRef,
      previewBaseOffset: previewController.previewBaseOffset,
      previewPan: editorState.previewPan,
      previewZoom: editorState.previewZoom,
      previewZoomPercent: previewController.previewZoomPercent,
      previewSize: previewController.previewSize,
      previewViewportOffset: previewController.previewViewportOffset,
      previewViewportWidth: previewController.previewViewportWidth,
      previewViewportHeight: previewController.previewViewportHeight,
      guideGeometry: previewController.guideGeometry,
      showShortformFrameOverlay: editorState.showShortformFrameOverlay,
      setShowShortformFrameOverlay: editorState.setShowShortformFrameOverlay,
      showSafeZoneGuides: editorState.showSafeZoneGuides,
      setShowSafeZoneGuides: editorState.setShowSafeZoneGuides,
      resetPreviewView: previewController.resetPreviewView,
      setOneToOnePreviewView: previewController.setOneToOnePreviewView,
      centerPreviewView: previewController.centerPreviewView,
      handlePreviewViewportWheel: previewController.handlePreviewViewportWheel,
      handlePreviewViewportMouseDownCapture:
        previewController.handlePreviewViewportMouseDownCapture,
      isPreviewPanning: editorState.isPreviewPanning,
      isPreviewPanModifierActive: editorState.isPreviewPanModifierActive,
      overlay: previewController.selectedPreviewOverlay,
      motionPath: previewController.selectedPreviewMotionPath,
      currentOpacity: propertyModel.resolvedOpacityDraft,
      currentRotation: propertyModel.resolvedRotationDraft,
      currentScale: propertyModel.resolvedScaleDraft,
      isDraggingAnchor: editorState.isDraggingAnchor,
      isDraggingPosition: editorState.isDraggingPosition,
      isDraggingOpacity: editorState.isDraggingOpacity,
      isDraggingRotation: editorState.isDraggingRotation,
      positionReadout: editorState.positionHandleReadout,
      opacityReadout: editorState.opacityHandleReadout,
      rotationReadout: editorState.rotationHandleReadout,
      scaleReadout: editorState.scaleHandleReadout,
      onStartScaleDrag: previewController.startPreviewScaleDrag,
      onStartMoveDrag: previewController.startPreviewPositionDrag,
      onStartOpacityDrag: previewController.startPreviewOpacityDrag,
      onStartRotationDrag: previewController.startPreviewRotationDrag,
      onTargetMouseDown: previewController.onTargetMouseDown,
      onAnchorMouseDown: previewController.onAnchorMouseDown,
      onMotionPathDotClick: previewController.handleSelectMotionPathFrame,
      onStartMotionPathKeyframeDrag: previewController.handleStartMotionPathKeyframeDrag,
      draggingMotionPathFrame: editorState.draggingMotionPathFrame,
      motionPathDragReadout: editorState.motionPathKeyframeReadout,
      onCommitScaleInput: transformActions.commitPreviewScaleInput,
      onCommitRotationInput: transformActions.commitPreviewRotationInput,
      onCommitOpacityInput: transformActions.commitPreviewOpacityInput,
    },
    propertiesPanelProps: {
      selectedComp: selectionModel.selectedComp,
      selectedMeta: selectionModel.selectedMeta,
      selectedPropertyTarget: selectionModel.selectedPropertyTarget,
      selectedPropertyState: selectionModel.selectedPropertyState,
      selectedLayer: selectionModel.selectedLayer,
      selectedTimelineComp: selectionModel.selectedTimelineComp,
      selectedScaleTarget: selectionModel.selectedScaleTarget,
      selectedScaleLinked: selectionModel.selectedScaleLinked,
      selectedKeyframe: editorState.selectedKeyframe,
      playheadFrame: timelineController.playheadFrame,
      defaultFrameRate: DEFAULT_FRAME_RATE,
      propertyLabels: PROPERTY_LABELS,
      animatableProperties: ANIMATABLE_PROPERTIES,
      propertyValueDrafts: propertyModel.propertyValueDrafts,
      evaluatedSelectedLayerPosition: propertyModel.evaluatedSelectedPosition,
      evaluatedSelectedScale: propertyModel.evaluatedSelectedScale,
      evaluatedSelectedRotation: propertyModel.evaluatedSelectedRotation,
      positionDraft: editorState.positionDraft,
      scaleDraft: editorState.scaleDraft,
      rotationDraft: editorState.rotationDraft,
      importError: editorState.importError,
      importNotice: editorState.importNotice,
      formatCompactTime,
      onTogglePropertyTrack: (property, enabled) => {
        const selectedComp = selectionModel.selectedComp;

        if (!selectedComp) {
          return;
        }

        if (selectionModel.selectedPropertyState[property] === enabled) {
          return;
        }

        editorState.pushCompositionHistorySnapshot(selectedComp.id);
        transformActions.handleTogglePropertyTrack(property, enabled);
      },
      onSetPositionDraft: editorState.setPositionDraft,
      onApplyPositionValue: (position, shouldCreateKeyframe) =>
        transformActions.applyPositionValue(position, getTransformEditMode(shouldCreateKeyframe)),
      onSetScaleDraft: editorState.setScaleDraft,
      onApplyScaleValue: (scale, shouldCreateKeyframe) =>
        transformActions.applyScaleValue(scale, getTransformEditMode(shouldCreateKeyframe)),
      onSetRotationDraft: editorState.setRotationDraft,
      onApplyRotationValue: transformActions.applyRotationInputValue,
      onSetOpacityDraft: editorState.setOpacityDraft,
      onApplyOpacityValue: (opacity, shouldCreateKeyframe) =>
        transformActions.applyOpacityValue(opacity, getTransformEditMode(shouldCreateKeyframe)),
      onBeginTransformHistoryCapture: beginSelectedCompositionHistoryCapture,
      onMarkTransformHistoryCaptureDirty: markSelectedCompositionHistoryCaptureDirty,
      onCommitTransformHistoryCapture: commitSelectedCompositionHistoryCapture,
      onSetScaleLinkState: transformActions.setScaleLinkState,
      onSavePositionKeyframe: transformActions.handleSavePositionKeyframe,
      onDeleteSelectedKeyframe: transformActions.handleDeleteSelectedKeyframe,
    },
    timelinePanelProps: {
    selectedComp: selectionModel.selectedComp,
    selectedMeta: selectionModel.selectedMeta,
    selectionBreadcrumbPath: timelineSelectionBreadcrumbPath,
    compositionSwitcherParentName: timelineCompositionSwitcher.parentName,
    compositionSwitcherParentIsCurrent: timelineCompositionSwitcher.parentIsCurrent,
    compositionSwitcherItems: timelineCompositionSwitcher.items,
      timelineNameColWidth: TIMELINE_NAME_COL_WIDTH,
      timelinePxPerFrame: timelineController.timelinePxPerFrame,
      timelineContentWidth: timelineController.timelineContentWidth,
      timelineFrames: timelineController.timelineFrames,
      displayedTimelineRows: selectionModel.displayedTimelineRows,
      selectedTimelineTarget: editorState.selectedTimelineTarget,
      selectedKeyframe: editorState.selectedKeyframe,
      draggingKeyframe: editorState.draggingKeyframe,
      draggingKeyframeDisplayFrame: timelineController.draggingKeyframeDisplayFrame,
      draggedTimelineItemId: editorState.draggedTimelineItemId,
      timelinePlayheadLeft: timelineController.timelinePlayheadLeft,
      playbackRangeStartFrame: timelinePlaybackRange.startFrame,
      playbackRangeEndFrame: timelinePlaybackRange.endFrame,
      hoveredPlayheadLeft: timelineController.hoveredPlayheadLeft,
      hoveredFrame: editorState.hoveredFrame,
      isScrubbingTimeline: editorState.isScrubbingTimeline,
      propertyLabels: PROPERTY_LABELS,
      allLayersById: selectionModel.allLayersById,
      allCompositionsById: selectionModel.allCompositionsById,
      timelineRulerRef: timelineController.timelineRulerRef,
      formatCompactTime,
      formatTimelineTime,
      onSetHoveredFrame: editorState.setHoveredFrame,
      onGetFrameFromPointer: timelineController.getFrameFromPointer,
      onRulerMouseDown: timelineController.updateFrameFromPointer,
      onSetScrubbing: timelineController.handleSetScrubbing,
      onResetToStart: timelineController.handleResetToStart,
      onStepBackward: timelineController.handleStepBackward,
      onStepForward: timelineController.handleStepForward,
      onTogglePlayback: timelineController.isPlaying
        ? timelineController.handlePause
        : timelineController.handlePlay,
      onDuplicateSelectedTimelineItem: timelineController.handleDuplicateSelectedTimelineItem,
      onSplitSelectedTimelineItem: timelineController.handleSplitSelectedTimelineItem,
      onSwitchComposition: enterComposition,
      onPlay: timelineController.handlePlay,
      onPause: timelineController.handlePause,
      isPlaying: timelineController.isPlaying,
      canDuplicateSelectedTimelineItem: !!timelineController.selectedTimelineTargetItem,
      canSplitSelectedTimelineItem: !!timelineController.selectedTimelineTargetItem,
      onSelectTimelineItem: timelineController.handleSelectTimelineItem,
      onAcknowledgeTimelineSourceStatus: handleAcknowledgeTimelineSourceStatus,
      onResolveTimelineSourceDelete: handleResolveTimelineSourceDelete,
      onRenameTimelineItem: timelineController.handleRenameTimelineItem,
      onTimelineReorder: timelineController.handleTimelineReorder,
      onBeginMoveTimelineItem: timelineController.beginMoveTimelineItem,
      onBeginResizeTimelineItemStart: timelineController.beginResizeTimelineItemStart,
      onBeginResizeTimelineItemEnd: timelineController.beginResizeTimelineItemEnd,
      onUpdateCompositionDuration: (durationFrames) => {
        const selectedComp = selectionModel.selectedComp;
        const selectedMeta = selectionModel.selectedMeta;

        if (!selectedComp || !selectedMeta) {
          return;
        }

        const nextDurationFrames = Math.max(1, durationFrames);
        const storedRange = editorState.playbackRangeByCompId[selectedComp.id];

        if (nextDurationFrames === selectedMeta.durationFrames) {
          return;
        }

        editorState.pushCompositionHistorySnapshot(selectedComp.id);

        editorState.setMetaByCompId((prev) => ({
          ...prev,
          [selectedComp.id]: {
            ...selectedMeta,
            durationFrames: nextDurationFrames,
          },
        }));
        editorState.setPlaybackRangeByCompId((prev) => {
          if (!storedRange) {
            return prev;
          }

          const nextStartFrame = Math.min(
            Math.max(storedRange.startFrame, 0),
            Math.max(nextDurationFrames - 1, 0)
          );
          const nextEndFrame = Math.min(
            Math.max(storedRange.endFrame, nextStartFrame + 1),
            nextDurationFrames
          );

          if (
            nextStartFrame === storedRange.startFrame &&
            nextEndFrame === storedRange.endFrame
          ) {
            return prev;
          }

          return {
            ...prev,
            [selectedComp.id]: {
              startFrame: nextStartFrame,
              endFrame: nextEndFrame,
            },
          };
        });
        editorState.setCurrentFrame((prev) => Math.min(prev, Math.max(nextDurationFrames - 1, 0)));
      },
      onUpdateCompositionPlaybackRange: (startFrame, endFrame) => {
        const selectedComp = selectionModel.selectedComp;
        const selectedMeta = selectionModel.selectedMeta;

        if (!selectedComp || !selectedMeta) {
          return;
        }

        const normalizedStartFrame = Math.max(0, Math.floor(startFrame));
        const clampedStartFrame = Math.min(
          normalizedStartFrame,
          Math.max(selectedMeta.durationFrames - 1, 0)
        );
        const normalizedEndFrame = Math.min(
          Math.max(Math.floor(endFrame), clampedStartFrame + 1),
          selectedMeta.durationFrames
        );

        editorState.setPlaybackRangeByCompId((prev) => ({
          ...prev,
          [selectedComp.id]: {
            startFrame: clampedStartFrame,
            endFrame: normalizedEndFrame,
          },
        }));
      },
      onBeginPlaybackRangeEdit: () =>
        editorState.beginCompositionHistoryCapture(selectionModel.selectedComp?.id ?? MASTER_COMP_ID),
      onMarkPlaybackRangeEditDirty: () =>
        editorState.markCompositionHistoryCaptureDirty(
          selectionModel.selectedComp?.id ?? MASTER_COMP_ID
        ),
      onCommitPlaybackRangeEdit: () =>
        editorState.commitCompositionHistoryCapture(
          selectionModel.selectedComp?.id ?? MASTER_COMP_ID
        ),
      onSetDraggedTimelineItemId: editorState.setDraggedTimelineItemId,
      onSelectKeyframe: timelineController.handleSelectKeyframe,
      onBeginMoveKeyframe: timelineController.handleBeginMoveKeyframe,
    },
  };
}
