import {
  analyzeMouthBasicTransitions,
} from "@/animation";
import type {
  LayerDocumentProject,
} from "@/models";
import {
  useEffect,
  useEffectEvent,
  useMemo,
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
  formatCompactTime,
  TIMELINE_NAME_COL_WIDTH,
  TIMELINE_PX_PER_FRAME,
  useLayerDocumentTimelineEngine,
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

function absoluteLayerStart(project: LayerDocumentProject, layerDocumentId: string) {
  let current: import("@/models").LayerDocument | null =
    project.payload.layerDocumentsById[layerDocumentId] ?? null;
  let start = 0;
  const visited = new Set<string>();
  while (current && !visited.has(current.layerDocumentId)) {
    visited.add(current.layerDocumentId);
    start += current.common.placement.startFrame;
    const parentId: string | null = current.common.placement.parentLayerDocumentId;
    current = parentId ? project.payload.layerDocumentsById[parentId] ?? null : null;
  }
  return start;
}

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
    });
  const properties =
    useLayerDocumentPropertiesEngine({
      port: panelPorts.properties,
      formatTime: formatCompactTime,
      resetRevision:
        runtime.ownerEffect.localUiRevision,
      mouthBasic: {
        readAudioOptions: () => Object.values(runtime.owner.state.currentProject.payload.layerDocumentsById)
          .filter((layer) => layer.type === "audio")
          .map((layer) => ({ id: layer.layerDocumentId, label: layer.common.placement.alias ?? layer.name })),
        connect: (targetLayerDocumentId, audioLayerDocumentId) => {
          const project = runtime.owner.state.currentProject;
          const target = project.payload.layerDocumentsById[targetLayerDocumentId];
          const audio = project.payload.layerDocumentsById[audioLayerDocumentId];
          if (!target || !audio || audio.type !== "audio" || target.type === "audio") return;
          const sourceId = audio.common.source?.sourceId;
          const resource = sourceId ? runtime.audio.resources.resolve(sourceId) : null;
          const decoded = resource?.decodedAudio as {
            sampleRate?: unknown;
            duration?: unknown;
            numberOfChannels?: unknown;
            getChannelData?: unknown;
          } | null;
          if (
            !decoded || typeof decoded.sampleRate !== "number" ||
            typeof decoded.duration !== "number" || typeof decoded.numberOfChannels !== "number" ||
            typeof decoded.getChannelData !== "function"
          ) return;
          const parent = target.common.placement.parentLayerDocumentId
            ? project.payload.layerDocumentsById[target.common.placement.parentLayerDocumentId]
            : null;
          const frameRate = parent?.type === "group" ? parent.data.frameRate : 30;
          const analysis = analyzeMouthBasicTransitions(decoded as import("@/animation").MouthBasicAudioBuffer, frameRate);
          const sourceStart = audio.common.placement.sourceOffsetFrames;
          const durationFrames = Math.max(1, Math.min(
            audio.common.placement.durationFrames,
            analysis.durationFrames - sourceStart
          ));
          const sourceEnd = sourceStart + durationFrames;
          const openAtStart = analysis.transitionFrames.filter((frame) => frame <= sourceStart).length % 2 === 1;
          const relativeTransitions = analysis.transitionFrames
            .filter((frame) => frame > sourceStart && frame < sourceEnd)
            .map((frame) => frame - sourceStart);
          if (openAtStart) relativeTransitions.unshift(0);
          const startFrame = target.common.placement.sourceOffsetFrames +
            absoluteLayerStart(project, audioLayerDocumentId) -
            absoluteLayerStart(project, targetLayerDocumentId);
          const modifiers = target.common.modifiers.map((modifier) =>
            modifier.type === "mouth-basic" ? {
              ...modifier,
              audioLayerDocumentId,
              startFrame,
              durationFrames,
              transitionFrames: relativeTransitions,
            } : modifier
          );
          panelPorts.properties.dispatchPanel({
            kind: "set-modifiers",
            layerDocumentId: targetLayerDocumentId,
            modifiers,
          });
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
  const library =
    useLayerDocumentLibraryEngine({
      controller:
        panelPorts.libraryController,
      audioImport: panelPorts.audioImport,
      audioRecording: panelPorts.audioRecording,
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
