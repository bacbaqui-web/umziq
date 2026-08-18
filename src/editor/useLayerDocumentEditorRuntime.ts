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
  createLayerDocumentProjectBrowserOpenAdapter,
  createLayerDocumentProjectBrowserWriteAdapter,
  createLayerDocumentProjectLifecycleController,
  createLayerDocumentProjectOpenController,
  createLayerDocumentProjectReconnectBrowserAdapter,
  createLayerDocumentProjectReconnectController,
  createLayerDocumentProjectSaveController,
  createLayerDocumentSourceRuntimeResolutionStore,
  createLayerDocumentAudioRuntimeStore,
  LAYER_DOCUMENT_PROJECT_LINKED_SOURCE_PREPARATION,
  type LayerDocumentProjectOwnerEffect,
  type LayerDocumentProjectLinkedSourceAccess,
} from "@/engines/project";
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
} from "@/editor/projectLifecycleUi";
import {
  createEditorProjectOwnerCommandAdapter,
  readEditorOwnerGroupScope,
  type EditorProjectOwnerPort,
} from "@/editor/project-owner";
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
  let importFiles:
    ((files: readonly File[]) => Promise<boolean>) | null =
      null;
  return {
    connect: (
      next: (files: readonly File[]) => Promise<boolean>
    ) => {
      importFiles = next;
    },
    importFiles: (files: readonly File[]) =>
      importFiles
        ? importFiles(files)
        : Promise.resolve(false),
  };
}

export function useLayerDocumentEditorRuntime(
  projectOwner: EditorProjectOwnerPort
) {
  const owner = projectOwner;
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
      const project = owner.state.currentProject;
      Object.values(
        project.payload.sourceRegistry.sourcesById
      ).forEach((source) => {
        if (
          source.kind !== "psd-document" &&
          source.kind !== "audio" &&
          source.kind !== "video"
        ) return;
        const resolution =
          sourceResolution.read(source.sourceId);
        if (
          resolution.status !== "available" ||
          !resolution.file
        ) return;
        localHandles.set(
          buildLayerDocumentLocalHandleKey(
            project.metadata.projectId,
            source.locator.locatorId
          ),
          {
            file: resolution.file,
            handle: resolution.handle,
            permission:
              resolution.permission === "denied"
                ? "unknown"
                : resolution.permission,
          }
        );
      });
    }),
    [localHandles, owner, sourceResolution]
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
  const [ownerEffect, setOwnerEffect] =
    useState<{
      revision: number;
      localUiRevision: number;
      effect:
        LayerDocumentProjectOwnerEffect | null;
    }>({
      revision: 0,
      localUiRevision: 0,
      effect: null,
    });
  const applyOwnerEffect = useCallback(
    (effect: LayerDocumentProjectOwnerEffect) => {
      timelineValidity.reconcile();
      setOwnerEffect((current) => ({
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
  const [ownerCommands] = useState(() =>
    createEditorProjectOwnerCommandAdapter({
      owner,
      sourceRuntime: resources,
      audioRuntime: audio,
      clearDraft: draftSession.clear,
      applyOwnerEffect,
      incrementMetric: NOOP_METRICS.increment,
    })
  );
  const readScope = () =>
    readEditorOwnerGroupScope(owner);
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
        enter: ownerCommands.enterGroup,
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
      const scope = readEditorOwnerGroupScope(owner);
      const playbackState = playback.read();
      if (!scope.ok) {
        audio.synchronizeTimeline({
          project: owner.state.currentProject,
          activeGroupLayerDocumentId: "",
          currentFrame: playbackState.currentFrame,
          frameRate: 1,
          isPlaying: false,
        });
        return;
      }
      audio.synchronizeTimeline({
        project: owner.state.currentProject,
        activeGroupLayerDocumentId: scope.model.activeGroupLayerDocumentId,
        currentFrame: playbackState.currentFrame,
        frameRate: scope.model.activeGroup.data.frameRate,
        isPlaying: playbackState.isPlaying,
      });
    };
    synchronizeAudio();
    return playback.subscribe(synchronizeAudio);
  }, [audio, owner, playback]);
  const [lifecycle] = useState(() =>
    createLayerDocumentProjectLifecycleController({
      owner,
      runtime: {
        stopPlayback: playback.commands.pause,
        clearDraft: draftSession.clear,
        invalidateSourceRuntime: (invalidation) => {
          const removed = resources.invalidate(invalidation);
          if (invalidation.kind === "all") {
            audio.replaceProject(owner.state.currentProject);
          }
          return removed;
        },
        resetSourceResolution:
          sourceResolution.reset,
        resetLocalUi: () => {},
        publishOwnerEffect: applyOwnerEffect,
      },
    })
  );
  const [saveController] = useState(() =>
    createLayerDocumentProjectSaveController({
      readProject: () =>
        owner.state.currentProject,
      lifecycle,
      browser:
        createLayerDocumentProjectBrowserWriteAdapter(),
    })
  );
  const [openController] = useState(() =>
  {
    const browser =
      createLayerDocumentProjectBrowserOpenAdapter();
    return createLayerDocumentProjectOpenController({
      lifecycle,
      browser: {
        ...browser,
        chooseProjectFile: async () => {
          const queued = takeProjectOpenSelection();
          return queued
            ? { ok: true, value: queued }
            : browser.chooseProjectFile();
        },
      },
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
            return {
              status: "available",
              file: recovered.file,
              handle:
                recovered.handle as FileSystemFileHandle,
              permission: "granted",
            };
          }
          try {
            return {
              status: "available",
              ...linked,
              file: linked.handle
                ? await linked.handle.getFile()
                : linked.file,
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
        owner.state.currentProject,
      browser:
        createLayerDocumentProjectReconnectBrowserAdapter(),
      preparation:
        LAYER_DOCUMENT_PROJECT_LINKED_SOURCE_PREPARATION,
      sourceRuntime: resources,
      audioRuntime: audio.resources,
      sourceResolution,
      localHandles: {
        update: (linked) => {
          localHandles.set(
            buildLayerDocumentLocalHandleKey(
              linked.projectId,
              linked.locatorId
            ),
            {
              file: linked.file,
              handle: linked.handle,
              permission: linked.permission,
            }
          );
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
        reconnect: reconnectController,
        createNewProject:
          createNewLayerDocumentEditorProject,
        importPsdFiles:
          newProjectPsdImport.importFiles,
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
    owner,
    ownerCommands,
    resources,
    audio,
    sourceResolution,
    draftSession,
    playback,
    projectLifecycleProps: {
      viewModel:
        projectLifecycleCommands.read(),
      commands: projectLifecycleCommands,
    },
    newProjectPsdImport,
    ownerEffect,
  };
}
