import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
} from "react";
import {
  PREVIEW_MIN_WORKSPACE_HEIGHT,
  PREVIEW_MIN_WORKSPACE_WIDTH,
  SHORTFORM_FRAME_HEIGHT,
  SHORTFORM_FRAME_WIDTH,
  useLayerDocumentCanvasEngine,
} from "@/engines/canvas";
import {
  useLayerDocumentPropertiesEngine,
} from "@/engines/properties";
import { useAudioEffectsEngine } from "@/engines/audio-effects";
import {
  createLayerDocumentLibraryPreviewReader,
  useLayerDocumentLibraryEngine,
} from "@/engines/library";
import {
  createEditorLibraryRecordingAssetStoreAdapter,
} from "@/editor/libraryRecordingAssetStoreAdapter";
import {
  formatCompactTime,
  TIMELINE_NAME_COL_WIDTH,
  TIMELINE_PX_PER_FRAME,
  useLayerDocumentTimelineEngine,
} from "@/engines/timeline";
import type {
  LayerDocumentTimelineTimingDraft,
} from "@/engines/timeline";
import type {
  EditorShellLayoutProps,
} from "@/editor/EditorShellLayout";
import {
  useEditorCanvasRuntimeState,
} from "@/editor/state/useEditorCanvasRuntimeState";
import {
  useEditorShellLayoutState,
} from "@/editor/state/useEditorShellLayoutState";
import {
  useEditorHistoryShortcuts,
} from "@/editor/useEditorHistoryShortcuts";
import {
  useEditorShellLayout,
} from "@/editor/useEditorShellLayout";
import {
  useLayerDocumentEditorOwner,
} from "@/editor/useLayerDocumentEditorOwner";
import {
  useLayerDocumentEditorRuntime,
} from "@/editor/useLayerDocumentEditorRuntime";
import {
  useLayerDocumentPanelEnginePorts,
} from "@/editor/useLayerDocumentPanelEnginePorts";
import {
  createFullResolutionProjectRenderer,
  exportProject,
} from "@/editor/projectExport";

export function useEditorCompositionRoot():
EditorShellLayoutProps {
  const shell = useEditorShellLayoutState();
  const owner = useLayerDocumentEditorOwner();
  const canvasState = useEditorCanvasRuntimeState(
    PREVIEW_MIN_WORKSPACE_WIDTH,
    PREVIEW_MIN_WORKSPACE_HEIGHT,
    owner.state.currentProject.metadata.projectId
  );
  const runtime =
    useLayerDocumentEditorRuntime(owner);
  const timelineTimingDraftRef =
    useRef<LayerDocumentTimelineTimingDraft | null>(null);
  const publishTimelineTimingDraft = useCallback(
    (
      draft: LayerDocumentTimelineTimingDraft | null
    ) => {
      timelineTimingDraftRef.current = draft;
    },
    []
  );
  const panelPorts =
    useLayerDocumentPanelEnginePorts({
      owner: runtime.owner,
      ownerCommands: runtime.ownerCommands,
      resources: runtime.resources,
      audioRuntime: runtime.audio,
      sourceResolution:
        runtime.sourceResolution,
      draftSession: runtime.draftSession,
      frameInput: runtime.playback,
      sourceSamplingQuality: "original",
      readTimelineTimingDraft: () =>
        timelineTimingDraftRef.current,
    });
  const scope = panelPorts.scope.read();
  if (!scope.ok) {
    throw new Error(
      `LayerDocument scope unavailable: ${scope.reason}`
    );
  }
  const timeline =
    useLayerDocumentTimelineEngine({
      owner: panelPorts.timelineOwner,
      playback: runtime.playback,
      nameColumnWidth:
        TIMELINE_NAME_COL_WIDTH,
      defaultPxPerFrame:
        TIMELINE_PX_PER_FRAME,
      allocateLayerDocumentId:
        panelPorts.allocateLayerDocumentId,
      sourceStatus: panelPorts.sourceStatus,
      formatTime: formatCompactTime,
      resetRevision:
        runtime.ownerEffect.localUiRevision,
      readAudioWaveform: runtime.audio.readWaveform,
      onTimingDraftChange:
        publishTimelineTimingDraft,
    });
  const properties =
    useLayerDocumentPropertiesEngine({
      port: panelPorts.properties,
      formatTime: formatCompactTime,
      resetRevision:
        runtime.ownerEffect.localUiRevision,
      mouthBasic: {
        readProject: () => runtime.owner.state.currentProject,
        readDecodedAudio: (sourceId) => {
          const resource = runtime.audio.resources.resolve(sourceId);
          const decoded = resource?.decodedAudio as {
            sampleRate?: unknown;
            duration?: unknown;
            numberOfChannels?: unknown;
            getChannelData?: unknown;
          } | null;
          return (
            !decoded || typeof decoded.sampleRate !== "number" ||
            typeof decoded.duration !== "number" || typeof decoded.numberOfChannels !== "number" ||
            typeof decoded.getChannelData !== "function"
          )
            ? null
            : decoded as import("@/animation").MouthBasicAudioBuffer;
        },
      },
    });
  const audioEffects = useAudioEffectsEngine({
    port: panelPorts.audioEffects,
    resetRevision: runtime.ownerEffect.localUiRevision,
  });
  const libraryPreview = useMemo(() =>
    createLayerDocumentLibraryPreviewReader({
      readProject: () => runtime.owner.state.currentProject,
      resources: runtime.resources,
      readAudioWaveform: runtime.audio.readWaveform,
    }), [runtime.audio, runtime.owner, runtime.resources]);
  const recordingAssetStore = useMemo(
    () => createEditorLibraryRecordingAssetStoreAdapter(),
    []
  );
  const library =
    useLayerDocumentLibraryEngine({
      controller:
        panelPorts.libraryController,
      audioImport: panelPorts.audioImport,
      audioRecording: panelPorts.audioRecording,
      recordingAssetStore,
      audio: panelPorts.libraryAudio,
      preview: { read: libraryPreview },
      parentLayerDocumentId:
        scope.model.activeGroup.layerDocumentId,
      durationFrames:
        scope.model.activeGroup.data
          .durationFrames,
      parentWidth: scope.model.activeGroup.data.width,
      parentHeight: scope.model.activeGroup.data.height,
      nextOrder:
        panelPorts.nextPsdLayerOrder,
      cacheContext:
        panelPorts.readPsdCacheContext,
      resetRevision: runtime.ownerEffect.localUiRevision,
    });
  runtime.newProjectPsdImport.connect(
    library.importFiles
  );
  const canvas =
    useLayerDocumentCanvasEngine({
      readPort: panelPorts.canvasRead,
      commandPort: panelPorts.canvasCommands,
      resources: runtime.resources,
      viewportState: canvasState,
      interactionState: canvasState,
      isPreviewPanning:
        canvasState.isPreviewPanning,
      isPreviewPanModifierActive:
        canvasState.isPreviewPanModifierActive,
      setIsPreviewPanning:
        canvasState.setIsPreviewPanning,
      setIsPreviewPanModifierActive:
        canvasState
          .setIsPreviewPanModifierActive,
      minWorkspaceWidth:
        PREVIEW_MIN_WORKSPACE_WIDTH,
      minWorkspaceHeight:
        PREVIEW_MIN_WORKSPACE_HEIGHT,
      shortformFrameWidth:
        SHORTFORM_FRAME_WIDTH,
      shortformFrameHeight:
        SHORTFORM_FRAME_HEIGHT,
      projectId:
        runtime.owner.state.currentProject.metadata.projectId,
      cameraScalePercent: canvasState.cameraScalePercent,
      setCameraScalePercent: (percent) =>
        canvasState.setCameraScalePercent(
          Math.min(1000, Math.max(1, percent))
        ),
      resetRevision:
        runtime.ownerEffect.revision,
    });
  const resetCanvasRuntime = useEffectEvent(() => {
    canvasState.setIsDraggingAnchor(false);
    canvasState.setIsDraggingPosition(false);
    canvasState.setIsDraggingScale(false);
    canvasState.setIsDraggingOpacity(false);
    canvasState.setIsDraggingRotation(false);
    canvasState
      .setIsDraggingMotionPathKeyframe(false);
    canvasState.setPositionHandleReadout(null);
    canvasState.setOpacityHandleReadout(null);
    canvasState.setRotationHandleReadout(null);
    canvasState.setScaleHandleReadout(null);
    canvasState
      .setMotionPathKeyframeReadout(null);
    canvasState.setDraggingMotionPathFrame(null);
    canvasState.setHoveredHandle(null);
    canvasState.setHoveredMotionFrame(null);
    canvasState
      .setPendingHandleInteraction(null);
    canvasState
      .setPendingMotionPathInteraction(null);
    canvasState
      .setSuppressedMotionPathClickFrame(null);
    canvasState.setIsAnchorHovered(false);
    canvasState.setDirectInput(null);
  });
  useEffect(() => {
    resetCanvasRuntime();
  }, [runtime.ownerEffect.revision]);
  const { startPanelResize } =
    useEditorShellLayout({
      leftPanelWidth: shell.leftPanelWidth,
      rightPanelWidth: shell.rightPanelWidth,
      setLeftPanelWidth:
        shell.setLeftPanelWidth,
      setRightPanelWidth:
        shell.setRightPanelWidth,
      setTimelinePanelHeight:
        shell.setTimelinePanelHeight,
      activePanelResize:
        shell.activePanelResize,
      setActivePanelResize:
        shell.setActivePanelResize,
      isDraggingAnchor:
        canvasState.isDraggingAnchor,
      isDraggingPosition:
        canvasState.isDraggingPosition,
      isDraggingMotionPathKeyframe:
        canvasState
          .isDraggingMotionPathKeyframe,
      isDraggingRotation:
        canvasState.isDraggingRotation,
      isPreviewPanning:
        canvasState.isPreviewPanning,
    });
  useEditorHistoryShortcuts({
    undo: panelPorts.history.undo,
    redo: panelPorts.history.redo,
  });
  const fullResolutionProjectRenderer = useMemo(
    () =>
      createFullResolutionProjectRenderer({
        readProject: () =>
          runtime.owner.state.currentProject,
        resources: runtime.resources,
        readSourceResolutionStatus: (sourceId) =>
          runtime.sourceResolution.read(sourceId).status,
        cameraScalePercent:
          canvasState.cameraScalePercent,
        activeGroupLayerDocumentId:
          scope.model.activeGroupLayerDocumentId,
      }),
    [
      canvasState.cameraScalePercent,
      runtime.owner,
      runtime.resources,
      runtime.sourceResolution,
      scope.model.activeGroupLayerDocumentId,
    ]
  );
  return {
    leftPanelWidth: shell.leftPanelWidth,
    rightPanelWidth: shell.rightPanelWidth,
    timelinePanelHeight:
      shell.timelinePanelHeight,
    activePanelResize:
      shell.activePanelResize,
    onStartLeftResize: (
      clientX,
      clientY
    ) => startPanelResize(
      "left",
      clientX,
      clientY,
      shell.leftPanelWidth
    ),
    onStartRightResize: (
      clientX,
      clientY
    ) => startPanelResize(
      "right",
      clientX,
      clientY,
      shell.rightPanelWidth
    ),
    onStartBottomResize: (
      clientX,
      clientY
    ) => startPanelResize(
      "bottom",
      clientX,
      clientY,
      shell.timelinePanelHeight
    ),
    libraryProps:
      library.viewProps,
    previewPaneProps: canvas.viewProps,
    propertiesPanelProps:
      properties.viewProps,
    audioEffectsPanelProps: audioEffects.viewProps,
    timelinePanelProps:
      timeline.viewProps,
    projectLifecycleProps: {
      ...runtime.projectLifecycleProps,
      exportOptions: {
        projectName:
          runtime.owner.state.currentProject.metadata.name,
        prepare: () =>
          panelPorts.libraryController.openProject(),
        durationFrames:
          scope.model.activeGroup.data.durationFrames,
        frameRate:
          scope.model.activeGroup.data.frameRate,
        run: (format, destination, onProgress, signal) =>
          exportProject({
            format,
            projectName:
              runtime.owner.state.currentProject.metadata.name,
            renderFrame:
              fullResolutionProjectRenderer,
            playback: runtime.playback,
            project: runtime.owner.state.currentProject,
            exportGroupLayerDocumentId:
              scope.model.activeGroupLayerDocumentId,
            resolveAudioResource: (sourceId) =>
              runtime.audio.resources.resolve(sourceId),
            durationFrames:
              scope.model.activeGroup.data.durationFrames,
            frameRate:
              scope.model.activeGroup.data.frameRate,
            onProgress,
            destination,
            signal,
          }),
      },
    },
  };
}
