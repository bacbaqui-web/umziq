import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  layerDocumentGlobalFrameToLocalFrame,
  buildCreateLayerDocumentTransaction,
  buildDuplicateLayerDocumentTransaction,
  buildUpdateLayerDocumentDomainTransaction,
  type DrawingLayerDocument,
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
  type NexusProjectReadPort,
  type NexusSelectionPort,
  type LayerDocumentSourceRuntimeResolutionPort,
} from "@/engines/project";
import {
  createLayerDocumentPropertiesCommandPort,
  createLayerDocumentPropertiesNexusCommandAdapter,
  LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
} from "@/engines/visual";
import { createAudioBasicNexusPort, createAudioEffectsNexusPort } from "@/engines/audio";
import {
  createLayerDocumentLibrarySourceCommandAdapter,
  confirmLayerDocumentAudioPreparedSource,
  type LibraryRecordingEditRequest,
} from "@/engines/library";
import {
  createLayerDocumentTimelineCommandAdapter,
  createLayerDocumentTimelineConsumerAdapter,
  createLayerDocumentTimelineSourceStatusAdapter,
  projectLayerDocumentTimelineTimingDraft,
  type LayerDocumentTimelineNexusPort,
  type LayerDocumentTimelinePlaybackPort,
  type LayerDocumentTimelineTimingDraftRuntime,
} from "@/engines/timeline";
import {
  createEditorNexusCommandAdapter,
  readEditorNexusGroupScope,
} from "@/editor/nexus";
import { editRecordedAudioFile } from "@/editor/audioRecordingEditAdapter";
import type { MicrophoneCapturePort } from "@/gateway";
import { prepareConvertLayerDocumentToDrawing } from "@/layer-types";

type NexusCommands = ReturnType<
  typeof createEditorNexusCommandAdapter
>;

export function useLayerDocumentPanelEnginePorts(
  options: {
    nexus: NexusProjectReadPort & NexusSelectionPort;
    nexusCommands: NexusCommands;
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
    timelineTimingDraftRuntime:
      LayerDocumentTimelineTimingDraftRuntime;
    microphone: MicrophoneCapturePort;
  }
) {
  const {
    nexus,
    nexusCommands,
    resources,
    audioRuntime,
    sourceResolution,
    draftSession,
    frameInput,
    sourceSamplingQuality,
    timelineTimingDraftRuntime,
    microphone,
  } = options;
  const readProject = () =>
    nexus.state.currentProject;
  const readCanvasProject = (): LayerDocumentProject =>
    projectLayerDocumentTimelineTimingDraft(
      readProject(),
      timelineTimingDraftRuntime.read()
    );
  const readSelectedLayerDocumentId = () =>
    nexus.state.session.layerSelection
      ?.layerDocumentId ?? null;
  const readActiveGroupLayerDocumentId = () =>
    nexus.state.session.activeGroupLayerDocumentId;
  const readScope = () =>
    readEditorNexusGroupScope(nexus);
  const [ports] = useState(() => {
    const audioEffects = createAudioEffectsNexusPort({
      readProject,
      readSelectedLayerDocumentId,
      commit: nexusCommands.commitLayerTransaction,
    });
    const audioBasic = createAudioBasicNexusPort({
      readProject,
      readSelectedLayerDocumentId,
      commit: nexusCommands.commitLayerTransaction,
    });
    const timelineCommands =
      createLayerDocumentTimelineCommandAdapter({
        nexus,
        readProject,
        commit:
          nexusCommands.commitLayerPreparation,
        deliver: nexusCommands.deliver,
      });
    const timelineConsumer =
      createLayerDocumentTimelineConsumerAdapter({
        nexus,
        readProject,
        readActiveGroupLayerDocumentId,
        readSelectedLayerDocumentId,
        readScope,
        resolution: sourceResolution,
        selectLayer: nexusCommands.selectLayer,
        dispatchIntent:
          timelineCommands.dispatchIntent,
      });
    const propertiesNexus =
      createLayerDocumentPropertiesNexusCommandAdapter<
        ReturnType<
          NexusCommands["commitLayerTransaction"]
        >
      >({
        readProject,
        readSelectedLayerDocumentId,
        preparation:
          LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
        readSourceResolutionStatus: (sourceId) =>
          sourceResolution.read(sourceId).status,
        reject: nexusCommands.reject,
        commit:
          nexusCommands.commitLayerTransaction,
      });
    const canvasDraft =
      createLayerDocumentCanvasDraftAdapter<
        ReturnType<
          NexusCommands["commitLayerTransaction"]
        >
      >({
        readProject: readCanvasProject,
        readActiveGroupLayerDocumentId,
        readSelectedLayerDocumentId,
        readSelectedTransformKeyframe: () =>
          nexus.state.runtimeSession
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
          propertiesNexus.rejectCanvasDraft,
        commitTransform:
          propertiesNexus.commitTransformIntent,
        commitMotionPath:
          propertiesNexus.commitPositionKeyframe,
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
          nexus.state.session.sourceSelection,
        selectLayer: nexusCommands.selectLayer,
        selectSource: nexusCommands.selectSource,
        enterGroup: nexusCommands.enterGroup,
        preparation:
          LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
        commit:
          nexusCommands.commitSourcePreparation,
        commitLayer:
          nexusCommands.commitLayerPreparation,
        bridge: registrationBridge,
        sourceResolution,
      });
    const timelineNexus: LayerDocumentTimelineNexusPort = {
      project: { read: readProject },
      scope: {
        read: readScope,
        enter: nexusCommands.enterGroup,
      },
      timeline: {
        readViewProps:
          timelineConsumer.readViewProps,
        dispatchIntent:
          timelineCommands.dispatchIntent,
        selectTransformKeyframe:
          timelineCommands.selectTransformKeyframe,
        acknowledgeSourceStatus:
          nexusCommands.acknowledgeSourceStatus,
      },
      runtime: {
        resources,
        resolutions: sourceResolution,
      },
    };
    const properties =
      createLayerDocumentPropertiesCommandPort({
        readDescriptor: propertiesNexus.describe,
        readProject,
        readDraft: draftSession.read,
        readGlobalFrame: () =>
          frameInput.read().currentFrame,
        previewDraft: canvasDraft.publish,
        commitDraft: canvasDraft.commitTransform,
        cancelDraft: canvasDraft.cancel,
        dispatchPanel: propertiesNexus.dispatch,
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
        enterGroup: nexusCommands.enterGroup,
        directSelect:
          nexusCommands.selectLayer,
        selectMotionPathKeyframe:
          timelineCommands.selectTransformKeyframe,
        playback: frameInput,
        sourceSamplingQuality,
      });
    return {
      audioEffects,
      audioBasic,
      timelineNexus,
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
        nexus: ports.timelineNexus,
      }),
    [ports.timelineNexus]
  );
  const allocatedIds = useRef(new Set<string>());
  const nextId = useRef(0);
  const allocateLayerDocumentId =
    useCallback(() => {
      const project =
        nexus.state.currentProject;
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
    }, [nexus]);
  const nextPsdLayerOrder =
    useCallback(() => {
      const project =
        nexus.state.currentProject;
      const scope =
        readEditorNexusGroupScope(nexus);
      if (!scope.ok) return 0;
      return Object.values(
        project.payload.layerDocumentsById
      ).filter((layer) =>
        layer.common.placement
          .parentLayerDocumentId ===
        scope.model.activeGroupLayerDocumentId
      ).length;
    }, [nexus]);
  const readPsdCacheContext =
    useCallback(() => {
      const project =
        nexus.state.currentProject;
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
      nexus,
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
    audioBasic: ports.audioBasic,
    timelineNexus: ports.timelineNexus,
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
      prepare: (source: {
        readonly fileName: string;
        readonly mimeType: string | null;
        readonly bytes: Uint8Array;
      }, relativePathHint?: string | null, order?: number, explicitCutLayerDocumentId?: string | null) => {
        const file = new File(
          [source.bytes.slice().buffer],
          source.fileName,
          { type: source.mimeType ?? "" }
        );
        return prepareLayerDocumentAudioImport({
          project: readProject(),
          file,
          token: `${Date.now()}:${file.name}`,
          explicitCutLayerDocumentId,
          selectedLayerDocumentId: readSelectedLayerDocumentId(),
          activeGroupLayerDocumentId: readActiveGroupLayerDocumentId(),
          relativePathHint,
          order,
        });
      },
      confirm: (prepared: Awaited<ReturnType<typeof prepareLayerDocumentAudioImport>>) =>
        confirmLayerDocumentAudioPreparedSource({
          prepared,
          readProject,
          prepare: (project, command) =>
            LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareImport(
              project,
              command
            ),
          commit: nexusCommands.commitSourcePreparation,
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
          microphone,
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
    drawing: {
      readSelected: () => {
        const id = readSelectedLayerDocumentId();
        const layer = id ? readProject().payload.layerDocumentsById[id] : null;
        return layer?.type === "drawing" ? layer : null;
      },
      replaceElements: (layerDocumentId: string, elements: DrawingLayerDocument["data"]["elements"]) =>
        nexusCommands.commitLayerPreparation(
          buildUpdateLayerDocumentDomainTransaction(readProject(), {
            layerDocumentId,
            update: { kind: "replace-drawing-document", data: { documentVersion: 3, elements } },
          })
        ).ok,
    },
    libraryLayerCommands: {
      createDrawing: () => {
        const scope = readEditorNexusGroupScope(nexus);
        if (!scope.ok) return false;
        const id = allocateLayerDocumentId();
        const siblings = Object.values(readProject().payload.layerDocumentsById)
          .filter((layer) => layer.common.placement.parentLayerDocumentId === scope.model.activeGroupLayerDocumentId);
        const layer: DrawingLayerDocument = {
          layerDocumentId: id,
          name: `드로잉 레이어 ${siblings.filter((entry) => entry.type === "drawing").length + 1}`,
          revision: 0,
          type: "drawing",
          common: {
            source: null,
            transform: {
              position: { x: scope.model.activeGroup.data.width / 2, y: scope.model.activeGroup.data.height / 2 },
              transformOffset: { x: 0, y: 0 },
              anchor: { x: scope.model.activeGroup.data.width / 2, y: scope.model.activeGroup.data.height / 2 },
              scale: { x: 100, y: 100 },
              scaleLinked: true,
              rotation: 0,
              opacity: 100,
            },
            placement: {
              parentLayerDocumentId: scope.model.activeGroupLayerDocumentId,
              order: siblings.length,
              startFrame: 0,
              durationFrames: scope.model.activeGroup.data.durationFrames,
              sourceOffsetFrames: 0,
              visible: true,
              alias: null,
            },
            animation: {
              positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [],
              enabledProperties: { position: false, scale: false, rotation: false, opacity: false },
            },
            effects: [], modifiers: [],
          },
          data: { documentVersion: 3, elements: [] },
        };
        return nexusCommands.commitLayerPreparation(
          buildCreateLayerDocumentTransaction(readProject(), { layer })
        ).ok;
      },
      duplicate: (layerDocumentId: string) =>
        nexusCommands.commitLayerPreparation(
          buildDuplicateLayerDocumentTransaction(readProject(), {
            layerDocumentId,
            newLayerDocumentId: allocateLayerDocumentId(),
          })
        ).ok,
      convertToDrawing: (layerDocumentId: string) => {
        const frame = canvasRead.read({ sourceSamplingQuality: "original" });
        if (!frame.runtime.ok) return false;
        const input = frame.runtime.model.inputs.find((entry) => entry.layerDocumentId === layerDocumentId);
        if (!input || input.type !== "psd" || input.content.kind !== "drawable" ||
          !input.sourceId || !input.sourceResourceCacheKey) return false;
        const resource = resources.resolve({ sourceId: input.sourceId,
          sourceResourceCacheKey: input.sourceResourceCacheKey });
        if (!resource) return false;
        const { width, height } = input.content.resolution.logicalSize;
        const surface = document.createElement("canvas");
        surface.width = width; surface.height = height;
        const context = surface.getContext("2d", { willReadFrequently: true });
        if (!context) return false;
        context.drawImage(resource.resource as CanvasImageSource, 0, 0, width, height);
        const dataUrl = surface.toDataURL("image/png");
        return nexusCommands.commitLayerPreparation(
          prepareConvertLayerDocumentToDrawing(readProject(), layerDocumentId, {
            documentVersion: 3,
            elements: [{ kind: "raster", width, height, dataUrl }],
          })
        ).ok;
      },
    },
    scope: ports.timelineNexus.scope,
    history: {
      undo: nexusCommands.undo,
      redo: nexusCommands.redo,
    },
  };
}
