import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  layerDocumentGlobalFrameToLocalFrame,
  type LayerDocument,
  type LayerDocumentProject,
} from "@/models";
import {
  createLayerDocumentCanvasCommandPort,
  createLayerDocumentCanvasDraftAdapter,
  type LayerDocumentCanvasDraftPort,
  type LayerDocumentCanvasReadPort,
} from "@/engines/canvas";
import {
  createLayerDocumentPsdRuntimeRegistrationBridge,
  type LayerDocumentSourceSamplingQuality,
  type LayerDocumentSourceRuntimeResourcePort,
} from "@/render";
import {
  createLayerDocumentLibraryController,
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
  prepareLayerDocumentAudioImport,
  cancelLayerDocumentAudioRecording,
  startLayerDocumentAudioRecording,
  beginLayerDocumentAudioRecording,
  stopLayerDocumentAudioRecording,
  type LayerDocumentAudioProcessingFeature,
  type PreparedLayerDocumentAudioImport,
  type LayerDocumentProjectOwnerPort,
  type LayerDocumentSourceRuntimeResolutionPort,
} from "@/engines/project";
import {
  createLayerDocumentPropertiesCommandPort,
  createLayerDocumentPropertiesOwnerCommandAdapter,
  LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
} from "@/engines/properties";
import { createAudioEffectsOwnerPort } from "@/engines/audio-effects";
import {
  createLayerDocumentLibrarySourceCommandAdapter,
  confirmLayerDocumentAudioPreparedSource,
  type LibraryRecordingEditRequest,
} from "@/engines/library";
import {
  createLayerDocumentTimelineCommandAdapter,
  createLayerDocumentTimelineConsumerAdapter,
  createLayerDocumentTimelineSourceStatusAdapter,
  type LayerDocumentTimelineOwnerPort,
  type LayerDocumentTimelinePlaybackPort,
  type LayerDocumentTimelineTimingDraft,
} from "@/engines/timeline";
import {
  createEditorProjectOwnerCommandAdapter,
  readEditorOwnerGroupScope,
} from "@/editor/project-owner";
import { editRecordedAudioFile } from "@/editor/audioRecordingEditAdapter";

type OwnerCommands = ReturnType<
  typeof createEditorProjectOwnerCommandAdapter
>;

export function useLayerDocumentPanelEnginePorts(
  options: {
    owner: LayerDocumentProjectOwnerPort;
    ownerCommands: OwnerCommands;
    resources:
      LayerDocumentSourceRuntimeResourcePort;
    audioRuntime: import("@/editor/audio-runtime").EditorAudioRuntimePort;
    sourceResolution:
      LayerDocumentSourceRuntimeResolutionPort;
    draftSession: LayerDocumentCanvasDraftPort;
    frameInput:
      LayerDocumentTimelinePlaybackPort;
    sourceSamplingQuality:
      LayerDocumentSourceSamplingQuality;
    readTimelineTimingDraft: () => LayerDocumentTimelineTimingDraft | null;
  }
) {
  const {
    owner,
    ownerCommands,
    resources,
    audioRuntime,
    sourceResolution,
    draftSession,
    frameInput,
    sourceSamplingQuality,
    readTimelineTimingDraft,
  } = options;
  const readProject = () =>
    owner.state.currentProject;
  const readCanvasProject = (): LayerDocumentProject => {
    const project = readProject();
    const timingDraft = readTimelineTimingDraft();
    if (!timingDraft) return project;
    const layer = project.payload.layerDocumentsById[timingDraft.layerDocumentId];
    if (!layer) return project;
    return {
      ...project,
      payload: {
        ...project.payload,
        layerDocumentsById: {
          ...project.payload.layerDocumentsById,
          [layer.layerDocumentId]: {
            ...layer,
            common: {
              ...layer.common,
              placement: {
                ...layer.common.placement,
                startFrame: timingDraft.startFrame,
                durationFrames: timingDraft.durationFrames,
                sourceOffsetFrames: timingDraft.sourceOffsetFrames,
              },
            },
          } as LayerDocument,
        },
      },
    };
  };
  const readSelectedLayerDocumentId = () =>
    owner.state.session.layerSelection
      ?.layerDocumentId ?? null;
  const readActiveGroupLayerDocumentId = () =>
    owner.state.session.activeGroupLayerDocumentId;
  const readScope = () =>
    readEditorOwnerGroupScope(owner);
  const [ports] = useState(() => {
    const audioEffects = createAudioEffectsOwnerPort({
      readProject,
      readSelectedLayerDocumentId,
      commit: ownerCommands.commitLayerTransaction,
    });
    const timelineCommands =
      createLayerDocumentTimelineCommandAdapter({
        owner,
        readProject,
        commit:
          ownerCommands.commitLayerPreparation,
        deliver: ownerCommands.deliver,
      });
    const timelineConsumer =
      createLayerDocumentTimelineConsumerAdapter({
        owner,
        readProject,
        readActiveGroupLayerDocumentId,
        readSelectedLayerDocumentId,
        readScope,
        resolution: sourceResolution,
        selectLayer: ownerCommands.selectLayer,
        dispatchIntent:
          timelineCommands.dispatchIntent,
      });
    const propertiesOwner =
      createLayerDocumentPropertiesOwnerCommandAdapter<
        ReturnType<
          OwnerCommands["commitLayerTransaction"]
        >
      >({
        readProject,
        readSelectedLayerDocumentId,
        preparation:
          LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
        readSourceResolutionStatus: (sourceId) =>
          sourceResolution.read(sourceId).status,
        reject: ownerCommands.reject,
        commit:
          ownerCommands.commitLayerTransaction,
      });
    const canvasDraft =
      createLayerDocumentCanvasDraftAdapter<
        ReturnType<
          OwnerCommands["commitLayerTransaction"]
        >
      >({
        readProject: readCanvasProject,
        readActiveGroupLayerDocumentId,
        readSelectedLayerDocumentId,
        readSelectedTransformKeyframe: () =>
          owner.state.runtimeSession
            .selectedTransformKeyframe,
        readScope,
        draft: draftSession,
        resolvePsdSource:
          resources.createPsdResolver(),
        sourceResolution,
        incrementMetric: () => {},
        preparePointerMove:
          LAYER_DOCUMENT_PANEL_PREPARATION_PORT
            .draft.preparePointerMove,
        preparePointerUp:
          LAYER_DOCUMENT_PANEL_PREPARATION_PORT
            .draft.preparePointerUp,
        rejectCommit:
          propertiesOwner.rejectCanvasDraft,
        commitTransform:
          propertiesOwner.commitTransformIntent,
        commitMotionPath:
          propertiesOwner.commitPositionKeyframe,
      });
    const registrationBridge =
      createLayerDocumentPsdRuntimeRegistrationBridge(
        resources
      );
    const sources =
      createLayerDocumentLibrarySourceCommandAdapter({
        readProject,
        readSelectedLayerDocumentId,
        readActiveGroupLayerDocumentId,
        readSourceSelection: () =>
          owner.state.session.sourceSelection,
        selectLayer: ownerCommands.selectLayer,
        selectSource: ownerCommands.selectSource,
        enterGroup: ownerCommands.enterGroup,
        preparation:
          LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
        commit:
          ownerCommands.commitSourcePreparation,
        commitLayer:
          ownerCommands.commitLayerPreparation,
        bridge: registrationBridge,
        sourceResolution,
      });
    const timelineOwner: LayerDocumentTimelineOwnerPort = {
      project: { read: readProject },
      scope: {
        read: readScope,
        enter: ownerCommands.enterGroup,
      },
      timeline: {
        readViewProps:
          timelineConsumer.readViewProps,
        dispatchIntent:
          timelineCommands.dispatchIntent,
        selectTransformKeyframe:
          timelineCommands.selectTransformKeyframe,
        acknowledgeSourceStatus:
          ownerCommands.acknowledgeSourceStatus,
      },
      runtime: {
        resources,
        resolutions: sourceResolution,
      },
    };
    const properties =
      createLayerDocumentPropertiesCommandPort({
        readDescriptor: propertiesOwner.describe,
        readProject,
        readDraft: draftSession.read,
        readGlobalFrame: () =>
          frameInput.read().currentFrame,
        previewDraft: canvasDraft.publish,
        commitDraft: canvasDraft.commitTransform,
        cancelDraft: canvasDraft.cancel,
        dispatchPanel: propertiesOwner.dispatch,
        dispatchTimeline:
          timelineCommands.dispatchIntent,
        selectKeyframe:
          timelineCommands.selectTransformKeyframe,
        readSelectedKeyframe: () =>
          timelineConsumer.readViewProps()
            .selectedTransformKeyframe,
        sourceSamplingQuality,
      });
    const libraryController =
      createLayerDocumentLibraryController({
        port: {
          readTree: sources.readTree,
          readProject,
          selectSource: sources.selectSource,
          toggleSourceVisibility:
            sources.toggleSourceVisibility,
          toggleSourceLock: sources.toggleSourceLock,
          openProject: sources.openProject,
          readActiveGroupLayerDocumentId:
            sources.readActiveGroupLayerDocumentId,
          confirmImport:
            sources.confirmPreparedPsdImport,
          cancelImport:
            sources.cancelPreparedPsdImport,
          confirmRefresh:
            sources.confirmPreparedPsdRefresh,
          cancelRefresh:
            sources.cancelPreparedPsdRefresh,
          refreshSource: sources.refreshSource,
          reconnect: sources.reconnect,
          deleteSource: sources.deleteSource,
          renameSourceLayer:
            sources.renameSourceLayer,
          deleteSourceLayer:
            sources.deleteSourceLayer,
          selectLayerDocument:
            sources.selectLayerDocument,
          toggleLayerVisibility:
            sources.toggleLayerVisibility,
          toggleLayerLock:
            sources.toggleLayerLock,
          renameLayerDocument:
            sources.renameLayerDocument,
          deleteLayerDocument:
            sources.deleteLayerDocument,
        },
      });
    const canvasCommands =
      createLayerDocumentCanvasCommandPort({
        draft: canvasDraft,
        enterGroup: ownerCommands.enterGroup,
        directSelect:
          ownerCommands.selectLayer,
        selectMotionPathKeyframe:
          timelineCommands.selectTransformKeyframe,
        playback: frameInput,
        sourceSamplingQuality,
      });
    return {
      audioEffects,
      timelineOwner,
      properties,
      libraryController,
      librarySources: sources,
      canvasDraft,
      canvasCommands,
    };
  });
  const sourceStatus = useMemo(
    () =>
      createLayerDocumentTimelineSourceStatusAdapter({
        owner: ports.timelineOwner,
      }),
    [ports.timelineOwner]
  );
  const allocatedIds = useRef(new Set<string>());
  const nextId = useRef(0);
  const allocateLayerDocumentId =
    useCallback(() => {
      const project =
        owner.state.currentProject;
      while (true) {
        nextId.current += 1;
        const candidate =
          `layer-document:ui:${nextId.current}`;
        if (
          !project.payload.layerDocumentsById[
            candidate
          ] &&
          !allocatedIds.current.has(candidate)
        ) {
          allocatedIds.current.add(candidate);
          return candidate;
        }
      }
    }, [owner]);
  const nextPsdLayerOrder =
    useCallback(() => {
      const project =
        owner.state.currentProject;
      const scope =
        readEditorOwnerGroupScope(owner);
      if (!scope.ok) return 0;
      return Object.values(
        project.payload.layerDocumentsById
      ).filter((layer) =>
        layer.common.placement
          .parentLayerDocumentId ===
        scope.model.activeGroupLayerDocumentId
      ).length;
    }, [owner]);
  const readPsdCacheContext =
    useCallback(() => {
      const project =
        owner.state.currentProject;
      const globalFrame =
        frameInput.read().currentFrame;
      return {
        globalFrame,
        localFrameByLayerDocumentId:
          Object.fromEntries(
            Object.values(
              project.payload.layerDocumentsById
            ).map((layer) => [
              layer.layerDocumentId,
              layerDocumentGlobalFrameToLocalFrame(
                globalFrame,
                layer.common.placement
              ),
            ])
          ),
        quality: sourceSamplingQuality,
      };
    }, [
      owner,
      frameInput,
      sourceSamplingQuality,
    ]);
  const canvasRead = useMemo<
    LayerDocumentCanvasReadPort
  >(
    () => ({
      read: (readOptions) => {
        const canvas =
          ports.canvasDraft.readViewProps({
            ...readOptions,
            globalFrame:
              frameInput.read().currentFrame,
          });
        if (!canvas.scope.ok) {
          throw new Error(
            `Canvas scope unavailable: ` +
            canvas.scope.reason
          );
        }
        const group =
          canvas.scope.model.activeGroup;
        return {
          selectedLayerDocumentId:
            canvas.selectedLayerDocumentId,
          runtime: canvas.runtime,
          activeScene: {
            layerDocumentId:
              group.layerDocumentId,
            label: group.name,
            width: group.data.width,
            height: group.data.height,
            frameRate:
              group.data.frameRate,
            durationFrames:
              group.data.durationFrames,
          },
        };
      },
    }),
    [ports.canvasDraft, frameInput]
  );
  return {
    audioEffects: ports.audioEffects,
    timelineOwner: ports.timelineOwner,
    properties: ports.properties,
    libraryController: ports.libraryController,
    libraryAudio: {
      read: audioRuntime.read,
      subscribe: audioRuntime.subscribe,
      readSelectedLayerDocumentId,
      select: ports.librarySources.selectLayerDocument,
      togglePlayback: (layerDocumentId: string) => {
        const state = audioRuntime.read();
        if (state.status === "playing" && state.layerDocumentId === layerDocumentId) {
          audioRuntime.stop();
          return;
        }
        audioRuntime.play({ project: readProject(), layerDocumentId });
      },
      toggleMuted: ports.librarySources.toggleAudioMuted,
      rename: ports.librarySources.renameLayerDocument,
      delete: ports.librarySources.deleteLayerDocument,
      move: ports.librarySources.moveLibraryLayer,
    },
    audioImport: {
      prepare: (file: File, relativePathHint?: string | null, order?: number, explicitCutLayerDocumentId?: string | null) =>
        prepareLayerDocumentAudioImport({
          project: readProject(),
          file,
          token: `${Date.now()}:${file.name}`,
          explicitCutLayerDocumentId,
          selectedLayerDocumentId: readSelectedLayerDocumentId(),
          activeGroupLayerDocumentId: readActiveGroupLayerDocumentId(),
          relativePathHint,
          order,
        }),
      confirm: (prepared: Awaited<ReturnType<typeof prepareLayerDocumentAudioImport>>) =>
        confirmLayerDocumentAudioPreparedSource({
          prepared,
          readProject,
          prepare: (project, command) =>
            LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareImport(
              project,
              command
            ),
          commit: ownerCommands.commitSourcePreparation,
          runtime: audioRuntime.resources,
          sourceResolution,
        }),
      cancel: (prepared: Awaited<ReturnType<typeof prepareLayerDocumentAudioImport>>) =>
        prepared.runtime.cancel(),
    },
    audioRecording: {
      start: (
        audioProcessingPreferences: Partial<Record<LayerDocumentAudioProcessingFeature, boolean>>,
        audioInputDeviceId?: string | null
      ) =>
        startLayerDocumentAudioRecording({
          project: readProject(),
          audioProcessingPreferences,
          audioInputDeviceId,
          selectedLayerDocumentId: readSelectedLayerDocumentId(),
          activeGroupLayerDocumentId: readActiveGroupLayerDocumentId(),
        }),
      begin: beginLayerDocumentAudioRecording,
      stop: (session: Awaited<ReturnType<typeof startLayerDocumentAudioRecording>>) =>
        stopLayerDocumentAudioRecording({
          session,
          project: readProject(),
          token: `recording:${Date.now()}`,
        }),
      cancel: cancelLayerDocumentAudioRecording,
      edit: async (
        prepared: PreparedLayerDocumentAudioImport,
        request: LibraryRecordingEditRequest
      ) => {
        const file = await editRecordedAudioFile(prepared.file, request);
        const parentLayerDocumentId =
          prepared.command.layers[0]?.common.placement.parentLayerDocumentId;
        if (!parentLayerDocumentId) {
          throw new Error("녹음을 넣을 위치를 찾지 못했습니다.");
        }
        return prepareLayerDocumentAudioImport({
          project: readProject(),
          file,
          token: `recording-edit:${Date.now()}:${file.name}`,
          explicitCutLayerDocumentId: parentLayerDocumentId,
          provenance: "recorded",
          reuseMatchingSource: false,
        });
      },
    },
    sourceStatus,
    allocateLayerDocumentId,
    nextPsdLayerOrder,
    readPsdCacheContext,
    canvasCommands: ports.canvasCommands,
    canvasRead,
    scope: ports.timelineOwner.scope,
    history: {
      undo: ownerCommands.undo,
      redo: ownerCommands.redo,
    },
  };
}
