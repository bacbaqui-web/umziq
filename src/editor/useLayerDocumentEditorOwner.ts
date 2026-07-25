import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  layerDocumentGlobalFrameToLocalFrame,
} from "@/models";
import {
  createLayerDocumentCanvasCutoverCommandPort,
  createLayerDocumentConsumerCutoverAssembly,
  createLayerDocumentPropertiesCommandPort,
  createLayerDocumentPsdTreeCommandPort,
} from "@/cutover";
import {
  LAYER_DOCUMENT_AUDIO_PREPARATION_PORT,
} from "@/engines/audio";
import {
  LAYER_DOCUMENT_DRAWING_PREPARATION_PORT,
} from "@/engines/drawing";
import {
  createLayerDocumentProjectBrowserOpenAdapter,
  createLayerDocumentProjectBrowserWriteAdapter,
  createLayerDocumentProjectLifecycleController,
  createLayerDocumentProjectOpenController,
  createLayerDocumentProjectReconnectBrowserAdapter,
  createLayerDocumentProjectReconnectController,
  createLayerDocumentProjectSaveController,
  createLayerDocumentPsdTreeController,
  createLayerDocumentSourceRuntimeResolutionStore,
  LAYER_DOCUMENT_PROJECT_LINKED_SOURCE_PREPARATION,
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
  type LayerDocumentProjectOwnerEffect,
  type LayerDocumentProjectLinkedSourceAccess,
  useLayerDocumentProjectOwner,
} from "@/engines/project";
import {
  createLayerDocumentSourceRuntimeResourceCache,
  type LayerDocumentTransformDraftSnapshot,
} from "@/engines/playback-render";
import {
  LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
  useLayerDocumentPropertiesEngine,
} from "@/engines/properties";
import {
  useLayerDocumentPsdTreeEngine,
} from "@/engines/psd-tree";
import {
  LAYER_DOCUMENT_TEXT_PREPARATION_PORT,
} from "@/engines/text";
import {
  createLayerDocumentTimelinePlaybackRuntime,
  createLayerDocumentTimelineSourceStatusAdapter,
  useLayerDocumentTimelineEngine,
  WINDOW_TIMELINE_PLAYBACK_SCHEDULER,
  TIMELINE_NAME_COL_WIDTH,
  TIMELINE_PX_PER_FRAME,
} from "@/engines/timeline";
import {
  formatCompactTime,
} from "@/engines/playback-render";
import {
  createInitialLayerDocumentOwnerOptions,
} from "@/editor/layerDocumentEditorBootstrap";
import {
  buildLayerDocumentLocalHandleKey,
  createNewLayerDocumentEditorProject,
} from "@/editor/layerDocumentEditorProjectIdentity";
import {
  createProjectLifecycleUiCommandPort,
} from "@/editor/projectLifecycleUi";

const NOOP_METRICS = {
  increment: () => {},
} as const;

export function useLayerDocumentEditorOwner(
  quality: string
) {
  const [initialOptions] = useState(
    createInitialLayerDocumentOwnerOptions
  );
  const owner =
    useLayerDocumentProjectOwner(initialOptions);
  const [resources] = useState(
    createLayerDocumentSourceRuntimeResourceCache
  );
  const [sourceResolution] = useState(
    createLayerDocumentSourceRuntimeResolutionStore
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
    []
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
  const [draftSession] = useState(() => ({
    read: () => draftRef.current,
    publish: (
      draft: LayerDocumentTransformDraftSnapshot
    ) => publishDraft(draft),
    clear: () => publishDraft(null),
  }));
  const [assembly] = useState(() =>
    createLayerDocumentConsumerCutoverAssembly({
      owner,
      panelPreparation:
        LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
      sourcePreparation:
        LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
      drawingPreparation:
        LAYER_DOCUMENT_DRAWING_PREPARATION_PORT,
      textPreparation:
        LAYER_DOCUMENT_TEXT_PREPARATION_PORT,
      audioPreparation:
        LAYER_DOCUMENT_AUDIO_PREPARATION_PORT,
      sourceRuntime: resources,
      sourceResolution,
      draftSession,
      effects: {
        applyOwnerEffect: (effect) =>
          applyOwnerEffect(effect),
      },
      metrics: NOOP_METRICS,
    })
  );
  const cacheContext = useCallback(() => {
    const project = assembly.project.read();
    const globalFrame =
      assembly.playback.read().currentFrame;
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
      quality,
    };
  }, [assembly, quality]);
  const [propertiesPort] = useState(() =>
    createLayerDocumentPropertiesCommandPort({
      assembly,
      readDraft: draftSession.read,
      quality,
    })
  );
  const properties =
    useLayerDocumentPropertiesEngine({
      port: propertiesPort,
      formatTime: formatCompactTime,
      resetRevision: ownerEffect.localUiRevision,
    });
  const [psdController] = useState(() =>
    createLayerDocumentPsdTreeController({
      port:
        createLayerDocumentPsdTreeCommandPort(
          assembly
        ),
    })
  );
  const scope = assembly.scope.read();
  if (!scope.ok) {
    throw new Error(
      `LayerDocument scope unavailable: ${scope.reason}`
    );
  }
  const activeGroup = scope.model.activeGroup;
  const order = useCallback(() => {
    const project = assembly.project.read();
    const currentScope = assembly.scope.read();
    if (!currentScope.ok) return 0;
    return Object.values(
      project.payload.layerDocumentsById
    ).filter((layer) =>
      layer.common.placement
        .parentLayerDocumentId ===
      currentScope.model
        .activeGroupLayerDocumentId
    ).length;
  }, [assembly]);
  const psdTree =
    useLayerDocumentPsdTreeEngine({
      controller: psdController,
      parentLayerDocumentId:
        activeGroup.layerDocumentId,
      durationFrames:
        activeGroup.data.durationFrames,
      nextOrder: order,
      cacheContext,
    });
  const [playback] = useState(() =>
    createLayerDocumentTimelinePlaybackRuntime({
      assembly,
      scheduler:
        WINDOW_TIMELINE_PLAYBACK_SCHEDULER,
      clearDraft: draftSession.clear,
    })
  );
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
  const [lifecycle] = useState(() =>
    createLayerDocumentProjectLifecycleController({
      owner,
      runtime: {
        stopPlayback: playback.commands.pause,
        clearDraft: draftSession.clear,
        invalidateSourceRuntime:
          resources.invalidate,
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
  const [openController] = useState(() =>
    createLayerDocumentProjectOpenController({
      lifecycle,
      browser:
        createLayerDocumentProjectBrowserOpenAdapter(),
      linkedSourceAccess: {
        find: async ({
          projectId,
          locatorId,
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
            return {
              status: "missing",
              message:
                "No session-local handle is available",
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
      sourceResolution,
      saveController,
    })
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
  const sourceStatus = useMemo(
    () =>
      createLayerDocumentTimelineSourceStatusAdapter({
        assembly,
      }),
    [assembly]
  );
  const allocatedIds = useRef(new Set<string>());
  const nextId = useRef(0);
  const allocateLayerDocumentId =
    useCallback(() => {
      const project = assembly.project.read();
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
    }, [assembly]);
  const timeline =
    useLayerDocumentTimelineEngine({
      assembly,
      playback,
      nameColumnWidth:
        TIMELINE_NAME_COL_WIDTH,
      defaultPxPerFrame:
        TIMELINE_PX_PER_FRAME,
      allocateLayerDocumentId,
      sourceStatus,
      formatTime: formatCompactTime,
      resetRevision: ownerEffect.localUiRevision,
    });
  const [canvasCommandPort] = useState(() =>
    createLayerDocumentCanvasCutoverCommandPort({
      assembly,
      quality,
    })
  );
  const canvasReadPort = useMemo(
    () => ({
      read: (options: {
        quality: string;
        rendererMode:
          "full-render" | "fast-render";
      }) => {
        const canvas =
          assembly.canvas.readViewProps(options);
        const currentScope = canvas.scope;
        if (!currentScope.ok) {
          throw new Error(
            `Canvas scope unavailable: ` +
            currentScope.reason
          );
        }
        const group =
          currentScope.model.activeGroup;
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
    [assembly]
  );
  return {
    owner,
    assembly,
    resources,
    sourceResolution,
    draftSession,
    canvasCommandPort,
    canvasReadPort,
    propertiesPanelProps:
      properties.viewProps,
    psdTreeProps: psdTree.viewProps,
    timelinePanelProps:
      timeline.viewProps,
    projectLifecycleProps: {
      viewModel:
        projectLifecycleCommands.read(),
      commands: projectLifecycleCommands,
    },
    ownerEffect,
  };
}
