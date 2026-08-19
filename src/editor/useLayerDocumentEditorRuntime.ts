import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  LayerDocumentCanvasDraftPort,
} from "@/engines/canvas";
import {
  createLayerDocumentProjectLifecycleController,
  createLayerDocumentProjectOpenController,
  createLayerDocumentProjectReconnectController,
  createLayerDocumentProjectSaveController,
  createLayerDocumentSourceRuntimeResolutionStore,
  createLayerDocumentAudioRuntimeStore,
  LAYER_DOCUMENT_PROJECT_LINKED_SOURCE_PREPARATION,
  type LayerDocumentNexusEffect,
  type LayerDocumentProjectLinkedSourceAccess,
} from "@/engines/project";
import {
  createWebProjectStorageGateway,
  createWebSourceAccessGateway,
} from "@/gateway";
import type { SourceResourceReference } from "@/gateway/contracts/sourceAccessGateway";
import {
  createLayerDocumentSourceRuntimeResourceCache,
  type LayerDocumentTransformDraftSnapshot,
} from "@/render";
import {
  createLayerDocumentTimelinePlaybackRuntime,
  type LayerDocumentTimelineRuntimePort,
  WINDOW_TIMELINE_PLAYBACK_SCHEDULER,
} from "@/engines/timeline";
import {
  buildLayerDocumentLocalHandleKey,
  createNewLayerDocumentEditorProject,
} from "@/editor/layerDocumentEditorProjectIdentity";
import {
  createProjectLifecycleUiCommandPort,
} from "@/engines/menu";
import {
  createEditorNexusCommandAdapter,
  readEditorNexusGroupScope,
  type EditorNexusPort,
} from "@/editor/nexus";
import {
  BROWSER_AUDIO_AUDITION_BACKEND,
  createEditorAudioRuntime,
} from "@/editor/audio-runtime";
import {
  takeProjectOpenSelection,
  findLinkedSourceInProjectAssets,
} from "@/editor/projectAssetDirectoryRuntime";

const NOOP_METRICS = {
  increment: () => {},
} as const;

function createTimelineValidityBridge() {
  let runtime:
    LayerDocumentTimelineRuntimePort | null =
      null;
  return {
    connect: (
      next: LayerDocumentTimelineRuntimePort
    ) => {
      runtime = next;
    },
    reconcile: () => {
      runtime?.validity.reconcile();
    },
  };
}

function createNewProjectPsdImportBridge() {
  let importSources:
    ((sources: readonly SourceResourceReference[]) => Promise<boolean>) | null =
      null;
  return {
    connect: (
      next: (sources: readonly SourceResourceReference[]) => Promise<boolean>
    ) => {
      importSources = next;
    },
    importSources: (sources: readonly SourceResourceReference[]) =>
      importSources
        ? importSources(sources)
        : Promise.resolve(false),
  };
}

export function useLayerDocumentEditorRuntime(
  nexus: EditorNexusPort
) {
  const [resources] = useState(
    createLayerDocumentSourceRuntimeResourceCache
  );
  const [audioResources] = useState(
    createLayerDocumentAudioRuntimeStore
  );
  const [audio] = useState(() =>
    createEditorAudioRuntime({
      resources: audioResources,
      backend: BROWSER_AUDIO_AUDITION_BACKEND,
    })
  );
  const audioDisposeTimer = useRef<number | null>(null);
  useEffect(() => {
    if (audioDisposeTimer.current !== null) {
      window.clearTimeout(audioDisposeTimer.current);
      audioDisposeTimer.current = null;
    }
    return () => {
      audioDisposeTimer.current = window.setTimeout(() => {
        audio.dispose();
        audioDisposeTimer.current = null;
      }, 0);
    };
  }, [audio]);
  const [sourceResolution] = useState(
    createLayerDocumentSourceRuntimeResolutionStore
  );
  const [localHandles] = useState(() =>
    new Map<
      string,
      {
        readonly file: File;
        readonly handle:
          FileSystemFileHandle | null;
        readonly permission:
          "unknown" | "prompt" | "granted";
      }
    >()
  );
  const [, setSourceResolutionRevision] = useState(0);
  useEffect(
    () => sourceResolution.subscribe(() => {
      setSourceResolutionRevision((revision) => revision + 1);
    }),
    [sourceResolution]
  );
  const resourceDisposeTimer =
    useRef<number | null>(null);
  useEffect(() => {
    if (resourceDisposeTimer.current !== null) {
      window.clearTimeout(
        resourceDisposeTimer.current
      );
      resourceDisposeTimer.current = null;
    }
    return () => {
      resourceDisposeTimer.current =
        window.setTimeout(() => {
          resources.dispose();
          resourceDisposeTimer.current = null;
        }, 0);
    };
  }, [resources]);
  const draftRef =
    useRef<LayerDocumentTransformDraftSnapshot | null>(
      null
    );
  const [, setDraftRevision] = useState(0);
  const [timelineValidity] = useState(
    createTimelineValidityBridge
  );
  const [newProjectPsdImport] = useState(
    createNewProjectPsdImportBridge
  );
  const [nexusEffect, setNexusEffect] =
    useState<{
      revision: number;
      localUiRevision: number;
      effect:
        LayerDocumentNexusEffect | null;
    }>({
      revision: 0,
      localUiRevision: 0,
      effect: null,
    });
  const applyNexusEffect = useCallback(
    (effect: LayerDocumentNexusEffect) => {
      timelineValidity.reconcile();
      setNexusEffect((current) => ({
        revision:
          current.revision +
          (effect.clearDraft ? 1 : 0),
        localUiRevision:
          current.localUiRevision +
          (effect.resetLocalUi ? 1 : 0),
        effect,
      }));
    },
    [timelineValidity]
  );
  const publishDraft = useCallback(
    (
      draft:
        LayerDocumentTransformDraftSnapshot | null
    ) => {
      draftRef.current = draft;
      setDraftRevision(
        (revision) => revision + 1
      );
    },
    []
  );
  const [draftSession] = useState<
    LayerDocumentCanvasDraftPort
  >(() => ({
    read: () => draftRef.current,
    publish: (
      draft: LayerDocumentTransformDraftSnapshot
    ) => publishDraft(draft),
    clear: () => publishDraft(null),
  }));
  const [nexusCommands] = useState(() =>
    createEditorNexusCommandAdapter({
      nexus,
      sourceRuntime: resources,
      audioRuntime: audio,
      clearDraft: draftSession.clear,
      applyNexusEffect,
      incrementMetric: NOOP_METRICS.increment,
    })
  );
  const readScope = () =>
    readEditorNexusGroupScope(nexus);
  const scope = readScope();
  if (!scope.ok) {
    throw new Error(
      `LayerDocument scope unavailable: ${scope.reason}`
    );
  }
  const activeGroup = scope.model.activeGroup;
  const [playback] = useState(() =>
    createLayerDocumentTimelinePlaybackRuntime({
      scope: {
        read: readScope,
        enter: nexusCommands.enterGroup,
      },
      scheduler:
        WINDOW_TIMELINE_PLAYBACK_SCHEDULER,
      clearDraft: draftSession.clear,
    })
  );
  timelineValidity.connect(playback);
  const playbackDisposeTimer =
    useRef<number | null>(null);
  useEffect(() => {
    if (playbackDisposeTimer.current !== null) {
      window.clearTimeout(
        playbackDisposeTimer.current
      );
      playbackDisposeTimer.current = null;
    }
    return () => {
      playbackDisposeTimer.current =
        window.setTimeout(() => {
          playback.dispose();
          playbackDisposeTimer.current = null;
        }, 0);
    };
  }, [playback]);
  useEffect(() => {
    playback.synchronizeClock();
  }, [
    activeGroup.data.frameRate,
    activeGroup.layerDocumentId,
    playback,
  ]);
  useEffect(() => {
    const synchronizeAudio = () => {
      const scope = readEditorNexusGroupScope(nexus);
      const playbackState = playback.read();
      if (!scope.ok) {
        audio.synchronizeTimeline({
          project: nexus.state.currentProject,
          activeGroupLayerDocumentId: "",
          currentFrame: playbackState.currentFrame,
          frameRate: 1,
          isPlaying: false,
        });
        return;
      }
      audio.synchronizeTimeline({
        project: nexus.state.currentProject,
        activeGroupLayerDocumentId: scope.model.activeGroupLayerDocumentId,
        currentFrame: playbackState.currentFrame,
        frameRate: scope.model.activeGroup.data.frameRate,
        isPlaying: playbackState.isPlaying,
      });
    };
    synchronizeAudio();
    return playback.subscribe(synchronizeAudio);
  }, [audio, nexus, playback]);
  const [lifecycle] = useState(() =>
    createLayerDocumentProjectLifecycleController({
      nexus,
      runtime: {
        stopPlayback: playback.commands.pause,
        clearDraft: draftSession.clear,
        invalidateSourceRuntime: (invalidation) => {
          const removed = resources.invalidate(invalidation);
          if (invalidation.kind === "all") {
            audio.replaceProject(nexus.state.currentProject);
          }
          return removed;
        },
        resetSourceResolution:
          sourceResolution.reset,
        resetLocalUi: () => {},
        publishNexusEffect: applyNexusEffect,
      },
    })
  );
  const [projectStorage] = useState(() =>
    createWebProjectStorageGateway({
      takeQueuedSelection: takeProjectOpenSelection,
    })
  );
  const [sourceAccess] = useState(() =>
    createWebSourceAccessGateway()
  );
  const [saveController] = useState(() =>
    createLayerDocumentProjectSaveController({
      readProject: () =>
        nexus.state.currentProject,
      lifecycle,
      storage: projectStorage,
    })
  );
  const [openController] = useState(() =>
  {
    return createLayerDocumentProjectOpenController({
      lifecycle,
      storage: projectStorage,
      linkedSourceAccess: {
        find: async ({
          projectId,
          locatorId,
          source,
        }): Promise<
          LayerDocumentProjectLinkedSourceAccess
        > => {
          const linked = localHandles.get(
            buildLayerDocumentLocalHandleKey(
              projectId,
              locatorId
            )
          );
          if (!linked) {
            if (
              source.kind !== "psd-document" &&
              source.kind !== "audio" &&
              source.kind !== "video"
            ) {
              return {
                status: "missing",
                message: "The Source does not have a linked-file locator",
              };
            }
            const recovered =
              await findLinkedSourceInProjectAssets({
                kind: source.kind,
                suggestedFileName:
                  source.locator.suggestedFileName,
                relativePathHint:
                  source.locator.relativePathHint,
                contentFingerprint:
                  source.contentFingerprint,
              });
            if (!recovered) {
              return {
                status: "missing",
                message:
                  "The linked Source was not found in the Project asset folders",
              };
            }
            const recoveredFile = recovered.file;
            return {
              status: "available",
              input: {
                fileName: recoveredFile.name,
                bytes: new Uint8Array(
                  await recoveredFile.arrayBuffer()
                ),
              },
              commitAvailable: (sourceIds) => {
                sourceIds.forEach((sourceId) =>
                  sourceResolution.setAvailable({
                    sourceId,
                    permission: "granted",
                  })
                );
              },
            };
          }
          try {
            const file = linked.handle
              ? await linked.handle.getFile()
              : linked.file;
            return {
              status: "available",
              input: {
                fileName: file.name,
                bytes: new Uint8Array(
                  await file.arrayBuffer()
                ),
              },
              commitAvailable: (sourceIds) => {
                sourceIds.forEach((sourceId) =>
                  sourceResolution.setAvailable({
                    sourceId,
                    permission: linked.permission,
                  })
                );
              },
            };
          } catch {
            return {
              status: "error",
              message:
                "The linked Source file could not be read",
            };
          }
        },
      },
      linkedSourcePreparation:
        LAYER_DOCUMENT_PROJECT_LINKED_SOURCE_PREPARATION,
      sourceRuntime: resources,
      audioRuntime: audio.resources,
      sourceResolution,
      saveController,
    });
  }
  );
  const [reconnectController] = useState(() =>
    createLayerDocumentProjectReconnectController({
      readProject: () =>
        nexus.state.currentProject,
      sourceAccess,
      preparation:
        LAYER_DOCUMENT_PROJECT_LINKED_SOURCE_PREPARATION,
      sourceRuntime: resources,
      audioRuntime: audio.resources,
      sourceResolution,
      reconnectCommit: {
        commitAvailable: (linked) => {
          sourceAccess.withFile(linked.source, (file) => {
            linked.sourceIds.forEach((sourceId) =>
              sourceResolution.setAvailable({
                sourceId,
                permission: "unknown",
              })
            );
          localHandles.set(
            buildLayerDocumentLocalHandleKey(
              linked.projectId,
              linked.locatorId
            ),
            {
              file,
              handle: null,
              permission: "unknown",
            }
          );
          });
        },
      },
    })
  );
  const [, setLifecycleUiRevision] =
    useState(0);
  const [projectLifecycleCommands] =
    useState(() =>
      createProjectLifecycleUiCommandPort({
        lifecycle,
        save: saveController,
        open: openController,
        createNewProject:
          createNewLayerDocumentEditorProject,
        importPsdSources:
          newProjectPsdImport.importSources,
        confirmDiscard: (intent) =>
          window.confirm(
            intent === "open-project"
              ? "저장하지 않은 변경 사항을 버리고 다른 프로젝트를 여시겠습니까?"
              : intent === "close-project"
                ? "저장하지 않은 변경 사항을 버리고 프로젝트를 닫으시겠습니까?"
                : "저장하지 않은 변경 사항을 버리고 새 프로젝트를 만드시겠습니까?"
          ),
        notify: () =>
          setLifecycleUiRevision(
            (revision) => revision + 1
          ),
      })
    );
  return {
    nexus,
    nexusCommands,
    resources,
    audio,
    sourceResolution,
    sourceAccess,
    reconnect: reconnectController,
    draftSession,
    playback,
    menuProps: {
      viewModel:
        projectLifecycleCommands.read(),
      commands: projectLifecycleCommands,
    },
    newProjectPsdImport,
    nexusEffect,
  };
}
