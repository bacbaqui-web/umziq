import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import {
  type AnimationCommands,
  useAnimationEngine,
} from "@/engines/animation";
import {
  type CanvasTransformDraftCommands,
  PREVIEW_MIN_WORKSPACE_HEIGHT,
  PREVIEW_MIN_WORKSPACE_WIDTH,
  SHORTFORM_FRAME_HEIGHT,
  SHORTFORM_FRAME_WIDTH,
  resolveDraftOverlayRuntimeValuesForTargetAtFrame,
  useCanvasComposition,
} from "@/engines/canvas";
import type { Position } from "@/models";
import { formatCompactTime, usePlaybackEngine } from "@/engines/playback-render";
import {
  DEFAULT_FRAME_RATE,
  MASTER_COMP_ID,
  MASTER_DEFAULT_HEIGHT,
  MASTER_DEFAULT_WIDTH,
  useProjectPsdEngine,
  useProjectSelectionModel,
} from "@/engines/project";
import { usePropertiesEngine } from "@/engines/properties";
import { usePsdTreeEngine } from "@/engines/psd-tree";
import {
  TIMELINE_NAME_COL_WIDTH,
  TIMELINE_PX_PER_FRAME,
  useTimelineEngine,
} from "@/engines/timeline";
import type { EditorShellLayoutProps } from "@/editor/EditorShellLayout";
import { useEditorHistoryShortcuts } from "@/editor/useEditorHistoryShortcuts";
import { useEditorShellLayout } from "@/editor/useEditorShellLayout";
import { useEditorState } from "@/editor/state/useEditorState";

export function useEditorCompositionRoot(): EditorShellLayoutProps {
  const canvasDraftCommandsRef = useRef<CanvasTransformDraftCommands | null>(null);
  const editorState = useEditorState({
    masterDefaultWidth: MASTER_DEFAULT_WIDTH,
    masterDefaultHeight: MASTER_DEFAULT_HEIGHT,
    previewMinWorkspaceWidth: PREVIEW_MIN_WORKSPACE_WIDTH,
    previewMinWorkspaceHeight: PREVIEW_MIN_WORKSPACE_HEIGHT,
    resetPreviewTransformDraft: () => canvasDraftCommandsRef.current?.reset(),
  });
  const setDraftTransformSnapshot = editorState.setDraftTransformSnapshot;
  const selectionModel = useProjectSelectionModel({
    masterCompId: MASTER_COMP_ID,
    masterWidth: MASTER_DEFAULT_WIDTH,
    masterHeight: MASTER_DEFAULT_HEIGHT,
    defaultFrameRate: DEFAULT_FRAME_RATE,
    comps: editorState.comps,
    masterEnabledProperties: editorState.masterEnabledProperties,
    masterAnchor: editorState.masterAnchor,
    masterScale: editorState.masterScale,
    masterScaleKeyframes: editorState.masterScaleKeyframes,
    masterScaleLinked: editorState.masterScaleLinked,
    masterRotation: editorState.masterRotation,
    masterRotationKeyframes: editorState.masterRotationKeyframes,
    masterOpacity: editorState.masterOpacity,
    masterOpacityKeyframes: editorState.masterOpacityKeyframes,
    selectedCompId: editorState.selectedCompId,
    selectedLayerId: editorState.selectedLayerId,
    selectedTimelineTarget: editorState.selectedTimelineTarget,
    metaByCompId: editorState.metaByCompId,
    timelineItemsByCompId: editorState.timelineItemsByCompId,
  });
  const projectEngine = useProjectPsdEngine({
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
    projectCommands: editorState.projectCommands,
    setSelectedCompId: editorState.setSelectedCompId,
    setNextImportIndex: editorState.setNextImportIndex,
    setImportError: editorState.setImportError,
    setImportNotice: editorState.setImportNotice,
    pushCompositionHistorySnapshot: editorState.pushCompositionHistorySnapshot,
    clearAllCompositionHistories: editorState.clearAllCompositionHistories,
    applySelectionForComposition: editorState.applySelectionForComposition,
  });
  const psdTreeEngine = usePsdTreeEngine({
    project: {
      rootCompositions: selectionModel.rootComps,
      selectedCompId: editorState.selectedCompId,
      preparePsdImport: projectEngine.preparePsdImport,
      confirmPsdImport: projectEngine.confirmPsdImport,
      cancelPsdImport: projectEngine.cancelPsdImport,
      refreshMainComposition: projectEngine.handleRefreshMainComp,
      removeMainComposition: projectEngine.handleDeleteMainComp,
      reorderMainCompositions: projectEngine.handleReorderMainComps,
    },
    selection: { selectComposition: projectEngine.enterComposition },
  });
  const playbackEngine = usePlaybackEngine({
    state: {
      playbackRangeByCompId: editorState.playbackRangeByCompId,
      setPlaybackRangeByCompId: editorState.setPlaybackRangeByCompId,
      currentFrame: editorState.currentFrame,
      setCurrentFrame: editorState.setCurrentFrame,
      isPlaying: editorState.isPlaying,
      setIsPlaying: editorState.setIsPlaying,
      rendererMode: editorState.rendererMode,
      setRendererMode: editorState.setRendererMode,
    },
    project: {
      selectedCompId: selectionModel.selectedComp.id,
      durationFrames: selectionModel.selectedMeta?.durationFrames ?? 0,
      frameRate: selectionModel.selectedMeta?.frameRate ?? DEFAULT_FRAME_RATE,
    },
    session: {
      setPositionDraft: editorState.setPositionDraft,
      setScaleDraft: editorState.setScaleDraft,
      setRotationDraft: editorState.setRotationDraft,
      setOpacityDraft: editorState.setOpacityDraft,
    },
  });
  const animationCommandsRef = useRef<AnimationCommands | null>(null);
  const updateAnchorDraft = useCallback((anchor: Position) => {
    return canvasDraftCommandsRef.current?.updateAnchor(anchor) ?? null;
  }, []);
  const resetTransformDraft = useCallback(() => {
    canvasDraftCommandsRef.current?.reset();
    setDraftTransformSnapshot(null);
  }, [setDraftTransformSnapshot]);
  const movePropertyKeyframe = useCallback<AnimationCommands["movePropertyKeyframe"]>(
    (...args) => animationCommandsRef.current?.movePropertyKeyframe(...args),
    []
  );
  const removePropertyKeyframe = useCallback<AnimationCommands["removePropertyKeyframe"]>(
    (...args) => animationCommandsRef.current?.removePropertyKeyframe(...args),
    []
  );
  const timelineEngine = useTimelineEngine({
    masterCompId: MASTER_COMP_ID,
    nameColumnWidth: TIMELINE_NAME_COL_WIDTH,
    defaultPxPerFrame: TIMELINE_PX_PER_FRAME,
    project: {
      selectedComposition: selectionModel.selectedComp,
      selectedMeta: selectionModel.selectedMeta,
      compositions: editorState.comps,
      selectedTimelineItems: selectionModel.selectedTimelineItems,
      renderItemsByCompId: editorState.renderItemsByCompId,
      allLayersById: selectionModel.allLayersById,
      allCompositionsById: selectionModel.allCompositionsById,
      commands: editorState.projectCommands,
    },
    selection: {
      selectedTimelineTarget: editorState.selectedTimelineTarget,
      selectedKeyframe: editorState.selectedKeyframe,
      draggingKeyframe: editorState.draggingKeyframe,
      draggedTimelineItemId: editorState.draggedTimelineItemId,
      applyForComposition: editorState.applySelectionForComposition,
      selectComposition: projectEngine.enterComposition,
      setSelectedCompId: editorState.setSelectedCompId,
      setSelectedKeyframe: editorState.setSelectedKeyframe,
      setDraggingKeyframe: editorState.setDraggingKeyframe,
      setDraggedTimelineItemId: editorState.setDraggedTimelineItemId,
    },
    playback: playbackEngine,
    playbackCommands: playbackEngine.commands,
    state: {
      hoveredFrame: editorState.hoveredFrame,
      isScrubbing: editorState.isScrubbingTimeline,
      setHoveredFrame: editorState.setHoveredFrame,
      setIsScrubbing: editorState.setIsScrubbingTimeline,
    },
    history: {
      push: editorState.pushCompositionHistorySnapshot,
      begin: editorState.beginCompositionHistoryCapture,
      markDirty: editorState.markCompositionHistoryCaptureDirty,
      commit: editorState.commitCompositionHistoryCapture,
    },
    sourceStatus: {
      acknowledge: projectEngine.handleAcknowledgeTimelineSourceStatus,
      resolveDelete: projectEngine.handleResolveTimelineSourceDelete,
    },
    movePropertyKeyframe,
    removePropertyKeyframe,
    formatTime: formatCompactTime,
  });
  const propertiesEngine = usePropertiesEngine({
    masterCompId: MASTER_COMP_ID,
    selection: {
      selectedComposition: selectionModel.selectedComp,
      selectedLayer: selectionModel.selectedLayer,
      selectedTimelineComposition: selectionModel.selectedTimelineComp,
      selectedPropertyTarget: selectionModel.selectedPropertyTarget,
      selectedTransformTarget: selectionModel.propertiesTransformTarget,
      selectedScaleTarget: selectionModel.propertiesScaleTarget,
      selectedScaleLinked: selectionModel.propertiesScaleLinked,
      selectedPropertyState: selectionModel.selectedPropertyState,
      selectedKeyframe: editorState.selectedKeyframe,
    },
    playback: { currentFrame: timelineEngine.playheadFrame, localFrame: timelineEngine.selectedTransformLocalFrame },
    project: {
      selectedMeta: selectionModel.selectedMeta,
      defaultFrameRate: DEFAULT_FRAME_RATE,
      importError: editorState.importError,
      importNotice: editorState.importNotice,
    },
    draftState: {
      positionDraft: editorState.positionDraft,
      scaleDraft: editorState.scaleDraft,
      rotationDraft: editorState.rotationDraft,
      opacityDraft: editorState.opacityDraft,
      numericDrafts: editorState.propertiesInputDrafts,
      numericDraftScope: editorState.propertiesInputDraftScope,
      focusedNumericInputId: editorState.focusedPropertiesInputId,
      setPositionDraft: editorState.setPositionDraft,
      setScaleDraft: editorState.setScaleDraft,
      setRotationDraft: editorState.setRotationDraft,
      setOpacityDraft: editorState.setOpacityDraft,
      setNumericDrafts: editorState.setPropertiesInputDrafts,
      setNumericDraftScope: editorState.setPropertiesInputDraftScope,
      setFocusedNumericInputId: editorState.setFocusedPropertiesInputId,
    },
    animationCommands: {
      applyPosition: (...args) => animationCommandsRef.current?.applyPosition(...args),
      applyScale: (...args) => animationCommandsRef.current?.applyScale(...args),
      applyRotation: (...args) => animationCommandsRef.current?.applyRotation(...args),
      applyOpacity: (...args) => animationCommandsRef.current?.applyOpacity(...args),
      applyAnchor: (...args) => animationCommandsRef.current?.applyAnchor(...args),
      setScaleLinked: (...args) => animationCommandsRef.current?.setScaleLinked(...args),
      setPropertyTrackEnabled: (...args) => animationCommandsRef.current?.setPropertyTrackEnabled(...args),
      savePositionKeyframe: () => animationCommandsRef.current?.savePositionKeyframe(),
      removeSelectedKeyframe: () => animationCommandsRef.current?.removeSelectedKeyframe(),
      toggleModifier: (...args) => animationCommandsRef.current?.toggleModifier(...args),
      updateModifierNumber: (...args) =>
        animationCommandsRef.current?.updateModifierNumber(...args),
      beginHistory: () => animationCommandsRef.current?.history.begin(),
      markHistoryDirty: () => animationCommandsRef.current?.history.markDirty(),
      commitHistory: () => animationCommandsRef.current?.history.commit(),
      cancelHistory: () => animationCommandsRef.current?.history.cancel?.(),
    },
    transformDraftCommands: {
      updateAnchor: updateAnchorDraft,
      reset: resetTransformDraft,
    },
    transformDraft: {
      anchor: resolveDraftOverlayRuntimeValuesForTargetAtFrame(
        selectionModel.propertiesTransformTarget,
        timelineEngine.selectedTransformLocalFrame,
        editorState.draftTransformSnapshot
      )?.anchor ?? null,
    },
    formatTime: formatCompactTime,
  });
  const animationEngine = useAnimationEngine({
    masterCompId: MASTER_COMP_ID,
    selectedComp: selectionModel.selectedComp,
    selectedLayer: selectionModel.selectedLayer,
    selectedTimelineComp: selectionModel.selectedTimelineComp,
    selectedTransformTarget: selectionModel.propertiesTransformTarget,
    selectedScaleTarget: selectionModel.propertiesScaleTarget,
    selectedScaleLinked: selectionModel.propertiesScaleLinked,
    selectedPropertyState: selectionModel.selectedPropertyState,
    selectedTransformLocalFrame: timelineEngine.selectedTransformLocalFrame,
    playheadFrame: timelineEngine.playheadFrame,
    resolvedPositionDraft: propertiesEngine.resolvedValues.position,
    resolvedScaleDraft: propertiesEngine.resolvedValues.scale,
    resolvedRotationDraft: propertiesEngine.resolvedValues.rotation,
    resolvedOpacityDraft: propertiesEngine.resolvedValues.opacity,
    selectedKeyframe: editorState.selectedKeyframe,
    project: { updateCompositions: editorState.projectCommands.updateCompositions },
    master: {
      setScale: editorState.setMasterScale,
      setScaleKeyframes: editorState.setMasterScaleKeyframes,
      setScaleLinked: editorState.setMasterScaleLinked,
      setRotation: editorState.setMasterRotation,
      setRotationKeyframes: editorState.setMasterRotationKeyframes,
      setOpacity: editorState.setMasterOpacity,
      setOpacityKeyframes: editorState.setMasterOpacityKeyframes,
      setEnabledProperties: editorState.setMasterEnabledProperties,
    },
    session: {
      setSelectedKeyframe: editorState.setSelectedKeyframe,
      setScaleDraft: editorState.setScaleDraft,
      setRotationDraft: editorState.setRotationDraft,
      setOpacityDraft: editorState.setOpacityDraft,
    },
    history: {
      push: () => editorState.pushCompositionHistorySnapshot(selectionModel.selectedComp.id),
      begin: () => editorState.beginCompositionHistoryCapture(selectionModel.selectedComp.id),
      markDirty: () => editorState.markCompositionHistoryCaptureDirty(selectionModel.selectedComp.id),
      commit: () => editorState.commitCompositionHistoryCapture(selectionModel.selectedComp.id),
      cancel: () => editorState.cancelCompositionHistoryCapture(selectionModel.selectedComp.id),
    },
  });
  useEffect(() => {
    animationCommandsRef.current = animationEngine;
    return () => { animationCommandsRef.current = null; };
  }, [animationEngine]);
  const canvasComposition = useCanvasComposition({
    masterCompId: MASTER_COMP_ID,
    previewMinWorkspaceWidth: PREVIEW_MIN_WORKSPACE_WIDTH,
    previewMinWorkspaceHeight: PREVIEW_MIN_WORKSPACE_HEIGHT,
    shortformFrameWidth: SHORTFORM_FRAME_WIDTH,
    shortformFrameHeight: SHORTFORM_FRAME_HEIGHT,
    comps: editorState.comps,
    selectedComp: selectionModel.selectedComp,
    selectedMeta: selectionModel.selectedMeta,
    selectedTransformTarget: selectionModel.selectedTransformTarget,
    selectedTimelineTargetItem: timelineEngine.selectedTimelineTargetItem,
    selectedTimelineItems: selectionModel.selectedTimelineItems,
    playheadFrame: timelineEngine.playheadFrame,
    rendererMode: playbackEngine.rendererMode,
    setRendererMode: playbackEngine.setRendererMode,
    selectedTransformLocalFrame: timelineEngine.selectedTransformLocalFrame,
    selectedPropertyState: selectionModel.selectedPropertyState,
    previewWorkspaceSize: editorState.previewWorkspaceSize,
    previewZoom: editorState.previewZoom,
    previewPan: editorState.previewPan,
    showShortformFrameOverlay: editorState.showShortformFrameOverlay,
    showSafeZoneGuides: editorState.showSafeZoneGuides,
    resolvedPositionDraft: propertiesEngine.resolvedValues.position,
    resolvedScaleDraft: propertiesEngine.resolvedValues.scale,
    resolvedRotationDraft: propertiesEngine.resolvedValues.rotation,
    resolvedOpacityDraft: propertiesEngine.resolvedValues.opacity,
    allLayersById: selectionModel.allLayersById,
    allCompositionsById: selectionModel.allCompositionsById,
    metaByCompId: editorState.metaByCompId,
    renderItemsByCompId: editorState.renderItemsByCompId,
    seekFrame: (frame) => playbackEngine.seek(frame, { clearTransformDrafts: false }),
    setPositionDraft: editorState.setPositionDraft,
    setScaleDraft: editorState.setScaleDraft,
    setRotationDraft: editorState.setRotationDraft,
    setOpacityDraft: editorState.setOpacityDraft,
    draftTransformSnapshot: editorState.draftTransformSnapshot,
    setDraftTransformSnapshot: editorState.setDraftTransformSnapshot,
    setPreviewWorkspaceSize: editorState.setPreviewWorkspaceSize,
    setPreviewZoom: editorState.setPreviewZoom,
    setPreviewPan: editorState.setPreviewPan,
    setShowShortformFrameOverlay: editorState.setShowShortformFrameOverlay,
    setShowSafeZoneGuides: editorState.setShowSafeZoneGuides,
    isPreviewPanning: editorState.isPreviewPanning,
    isPreviewPanModifierActive: editorState.isPreviewPanModifierActive,
    setIsPreviewPanning: editorState.setIsPreviewPanning,
    setIsPreviewPanModifierActive: editorState.setIsPreviewPanModifierActive,
    interactionState: editorState,
    history: {
      push: animationEngine.history.push,
      begin: animationEngine.history.begin,
      markDirty: animationEngine.history.markDirty,
      commit: animationEngine.history.commit,
      cancel: animationEngine.history.cancel ?? (() => {}),
    },
    applySelectionForComposition: editorState.applySelectionForComposition,
    animation: {
      applyPosition: animationEngine.applyPositionValue,
      applyScale: animationEngine.applyScaleValue,
      applyRotation: animationEngine.applyRotationValue,
      applyOpacity: animationEngine.applyOpacityValue,
      applyAnchor: animationEngine.applyAnchor,
      upsertPropertyKeyframe: animationEngine.upsertPropertyKeyframe,
      selectPropertyKeyframe: animationEngine.selectPropertyKeyframe,
      commitScaleInput: animationEngine.commitPreviewScaleInput,
      commitRotationInput: animationEngine.commitPreviewRotationInput,
      commitOpacityInput: animationEngine.commitPreviewOpacityInput,
    },
  });
  useEffect(() => {
    canvasDraftCommandsRef.current = canvasComposition.canvasEngine.draftTransformCommands;
    return () => { canvasDraftCommandsRef.current = null; };
  }, [canvasComposition.canvasEngine.draftTransformCommands]);
  const transformDraftScope = [
    selectionModel.selectedComp.id,
    selectionModel.selectedTransformTarget?.kind ?? "none",
    selectionModel.selectedTransformTarget?.kind === "layer"
      ? selectionModel.selectedTransformTarget.layer.id
      : selectionModel.selectedTransformTarget?.composition.id ?? "none",
    timelineEngine.playheadFrame,
    timelineEngine.selectedTransformLocalFrame,
  ].join(":");
  const resetTransformDraftForScopeChange = useEffectEvent(() => {
    if (!editorState.draftTransformSnapshot) return;
    resetTransformDraft();
  });
  useEffect(() => {
    resetTransformDraftForScopeChange();
  }, [transformDraftScope]);
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
  useEditorHistoryShortcuts({
    selectedCompId: selectionModel.selectedComp.id,
    undo: editorState.undoCompositionHistory,
    redo: editorState.redoCompositionHistory,
  });

  return {
    leftPanelWidth: editorState.leftPanelWidth,
    rightPanelWidth: editorState.rightPanelWidth,
    timelinePanelHeight: editorState.timelinePanelHeight,
    activePanelResize: editorState.activePanelResize,
    onStartLeftResize: (clientX, clientY) => startPanelResize("left", clientX, clientY, editorState.leftPanelWidth),
    onStartRightResize: (clientX, clientY) => startPanelResize("right", clientX, clientY, editorState.rightPanelWidth),
    onStartBottomResize: (clientX, clientY) => startPanelResize("bottom", clientX, clientY, editorState.timelinePanelHeight),
    psdTreeProps: psdTreeEngine.viewProps,
    previewPaneProps: canvasComposition.viewProps,
    propertiesPanelProps: propertiesEngine.viewProps,
    timelinePanelProps: timelineEngine.viewProps,
  };
}
