import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  PsdImportPlan,
  PsdImportPlanNode,
  SourceRegistryCacheInvalidationContext,
  LayerDocumentPsdImportPreviewPlan,
  LayerDocumentLibraryController,
  LayerDocumentPsdPreparedSessionController,
  PreparedLayerDocumentAudioImport,
} from "@/engines/project";
import {
  createLayerDocumentPsdPreparedSessionController,
} from "@/engines/project";
import type {
  PsdRefreshSummaryViewModel,
  LibraryNodeViewModel,
  LibraryViewProps,
} from "@/engines/library/models/libraryModel";

function previewToken(
  plan: LayerDocumentPsdImportPreviewPlan
) {
  return plan.prepared.command.sources.find(
    (source) => source.kind === "psd-document"
  )?.sourceId ?? plan.prepared.fileName;
}

function previewTree(
  plan: LayerDocumentPsdImportPreviewPlan
): PsdImportPlanNode[] {
  const layerById = new Map(
    plan.prepared.command.layers.map((layer) => [
      layer.layerDocumentId,
      layer,
    ])
  );
  const nodeById = new Map(
    plan.nodes.map((node) => [node.layerDocumentId, node])
  );
  const sourceById = new Map(
    plan.prepared.command.sources.map((source) => [
      source.sourceId,
      source,
    ])
  );
  const build = (
    layerDocumentId: string
  ): PsdImportPlanNode | null => {
    const layer = layerById.get(layerDocumentId);
    const node = nodeById.get(layerDocumentId);
    if (!layer || !node) return null;
    const sourceId = layer.common.source?.sourceId;
    const source = sourceId
      ? sourceById.get(sourceId)
      : null;
    return {
      id: layer.layerDocumentId,
      sourceKey:
        source?.kind === "psd-node"
          ? source.data.sourceKey
          : layer.layerDocumentId,
      kind: node.canContainChildren ? "group" : "layer",
      originalName: layer.name,
      displayName: layer.name,
      autoRenamed: false,
      previewUrl:
        plan.prepared.previewImagesByLayerDocumentId?.[
          layer.layerDocumentId
        ] || undefined,
      previewEmpty:
        plan.prepared.previewImagesByLayerDocumentId?.[
          layer.layerDocumentId
        ] === "",
      previewWidth:
        plan.prepared.previewSizesByLayerDocumentId?.[
          layer.layerDocumentId
        ]?.width,
      previewHeight:
        plan.prepared.previewSizesByLayerDocumentId?.[
          layer.layerDocumentId
        ]?.height,
      children: plan.nodes
        .filter((candidate) =>
          candidate.parentLayerDocumentId === layerDocumentId
        )
        .sort((left, right) => left.order - right.order)
        .flatMap((candidate) => {
          const child = build(candidate.layerDocumentId);
          return child ? [child] : [];
        }),
    };
  };
  const ids = new Set(plan.nodes.map((node) => node.layerDocumentId));
  return plan.nodes
    .filter((node) =>
      !node.parentLayerDocumentId ||
      !ids.has(node.parentLayerDocumentId)
    )
    .sort((left, right) => left.order - right.order)
    .flatMap((node) => {
      const built = build(node.layerDocumentId);
      return built ? [built] : [];
    });
}

export function buildLayerDocumentPsdImportViewPlan(
  plans: readonly LayerDocumentPsdImportPreviewPlan[]
): PsdImportPlan {
  return {
    entries: plans.map((plan) => ({
      token: previewToken(plan),
      scalePercent: plan.scalePercent,
      analysis: {
        fileName: plan.prepared.fileName,
        width: plan.prepared.width,
        height: plan.prepared.height,
        groupCount: plan.prepared.groupCount,
        layerCount: plan.prepared.layerCount,
        hiddenLayerCount: 0,
        warnings: [],
        conflict: null,
      },
      settings: {
        compositionName:
          plan.prepared.command.layers.find((layer) =>
            layer.layerDocumentId ===
              plan.prepared.command.selectLayerDocumentId
          )?.name ?? plan.prepared.fileName.replace(/\.psd$/i, ""),
        hiddenLayerMode: "preserve",
      },
      tree: previewTree(plan),
    })),
  };
}

function treeNode(
  source: {
    readonly sourceId: string;
    readonly displayName: string;
    readonly refreshStatus:
      | "normal"
      | "updated"
      | "new"
      | "deletePending"
      | "missing";
    readonly entityKind?: "layer" | "composition";
    readonly children?: readonly unknown[];
  },
  selectedSourceId: string | null,
  depth: number,
  children: LibraryNodeViewModel[],
  documentActions: boolean,
  layerState: {
    visible: boolean;
    locked: boolean;
    name: string;
  } | null
): LibraryNodeViewModel {
  return {
    id: source.sourceId,
    type: depth === 0 ? "main" : "sub",
    entityKind:
      depth === 0 ? null : source.entityKind ?? "layer",
    contentKind: "visual",
    audioProvenance: null,
    playing: false,
    muted: false,
    sourceId: source.sourceId,
    layerDocumentId: null,
    name: layerState?.name ?? source.displayName,
    depth,
    selected: source.sourceId === selectedSourceId,
    visible: layerState?.visible ?? true,
    locked: layerState?.locked ?? false,
    sourceSyncStatus: source.refreshStatus,
    canRefresh: documentActions,
    canDelete: documentActions,
    canReorder: false,
    children,
  };
}

export function buildLayerDocumentLibraryNodes(
  controller: LayerDocumentLibraryController,
  audioState?: {
    readonly selectedLayerDocumentId: string | null;
    readonly playingLayerDocumentId: string | null;
  }
): LibraryNodeViewModel[] {
  const tree = controller.read();
  const project = controller.readProject();
  const projectRoot = Object.values(
    project.payload.layerDocumentsById
  ).find((layer) =>
    layer.type === "group" &&
    layer.data.role === "project-root"
  );
  const layerState = (sourceId: string) => {
    const layer = Object.values(
      project.payload.layerDocumentsById
    ).find((candidate) =>
      candidate.common.source?.sourceId === sourceId
    );
    return layer
      ? {
          visible: layer.common.placement.visible,
          locked: !!layer.common.placement.locked,
          name: layer.name,
        }
      : null;
  };
  const buildPsdNode = (
    node: (typeof tree.documents)[number]["children"][number],
    depth: number
  ): LibraryNodeViewModel => {
    const state = layerState(node.sourceId);
    return treeNode(
      node,
      tree.selectedSourceId,
      depth,
      node.children.map((child) =>
        buildPsdNode(child, depth + 1)
      ),
      false,
      state
    );
  };
  const audioSources = new Map(
    Object.values(project.payload.sourceRegistry.sourcesById)
      .filter((source) => source.kind === "audio")
      .map((source) => [source.sourceId, source])
  );
  const audioTreeStatus = new Map(
    tree.nonPsdSources
      .filter((source) => source.kind === "audio")
      .map((source) => [source.sourceId, source.refreshStatus])
  );
  const audioNodesForCut = (cutLayerDocumentId: string | null) =>
    Object.values(project.payload.layerDocumentsById)
      .flatMap((layer) => layer.type === "audio" &&
        layer.common.placement.parentLayerDocumentId === cutLayerDocumentId
          ? [layer]
          : [])
      .sort((left, right) =>
        left.common.placement.order - right.common.placement.order ||
        left.layerDocumentId.localeCompare(right.layerDocumentId)
      )
      .map((layer): LibraryNodeViewModel => {
        const sourceId = layer.common.source?.sourceId ?? null;
        const source = sourceId ? audioSources.get(sourceId) : null;
        return {
          id: layer.layerDocumentId,
          type: "sub",
          entityKind: "layer",
          contentKind: "audio",
          audioProvenance: source?.data.provenance ?? "imported",
          playing: audioState?.playingLayerDocumentId === layer.layerDocumentId,
          muted: layer.data.muted,
          sourceId,
          layerDocumentId: layer.layerDocumentId,
          name: layer.name,
          depth: 1,
          selected: audioState?.selectedLayerDocumentId === layer.layerDocumentId,
          visible: !layer.data.muted,
          locked: false,
          sourceSyncStatus: sourceId
            ? audioTreeStatus.get(sourceId) ?? "missing"
            : "missing",
          canRefresh: false,
          canDelete: true,
          canReorder: false,
          children: [],
        };
      });
  const documents = tree.documents.map((document) => {
    const cut = Object.values(project.payload.layerDocumentsById).find((layer) =>
      layer.type === "group" &&
      layer.data.role === "composition" &&
      layer.common.source?.sourceId === document.sourceId
    );
    return treeNode(
      document,
      tree.selectedSourceId,
      0,
      [
        ...document.children.map((child) => buildPsdNode(child, 1)),
        ...audioNodesForCut(cut?.layerDocumentId ?? null),
      ],
      true,
      layerState(document.sourceId)
    );
  });
  const orphanNodes = tree.orphanNodes.map((node) =>
    buildPsdNode(node, 0)
  );
  const nonPsdSources = tree.nonPsdSources
    .filter((source) => source.kind !== "audio")
    .map((source) =>
    treeNode(
      source,
      tree.selectedSourceId,
      0,
      [],
      false,
      layerState(source.sourceId)
    )
  );
  const projectNode: LibraryNodeViewModel[] = projectRoot
    ? [{
        id: projectRoot.layerDocumentId,
        type: "project",
        entityKind: "composition",
        contentKind: "visual",
        audioProvenance: null,
        playing: false,
        muted: false,
        sourceId: null,
        layerDocumentId: projectRoot.layerDocumentId,
        name: "프로젝트",
        depth: 0,
        selected:
          controller.readActiveGroupLayerDocumentId() ===
          projectRoot.layerDocumentId,
        visible: true,
        locked: false,
        sourceSyncStatus: "normal",
        canRefresh: false,
        canDelete: false,
        canReorder: false,
        children: [],
      }]
    : [];
  return [
    ...projectNode,
    ...documents,
    ...orphanNodes,
    ...nonPsdSources,
  ];
}

function refreshSummary(
  compositionName: string,
  summary: {
    readonly updatedSourceIds: readonly string[];
    readonly newSourceIds: readonly string[];
    readonly deletePendingSourceIds: readonly string[];
  }
): PsdRefreshSummaryViewModel {
  const updated = summary.updatedSourceIds.length;
  const created = summary.newSourceIds.length;
  const deleted = summary.deletePendingSourceIds.length;
  return {
    compositionName,
    hasChanges: updated + created + deleted > 0,
    problematic: deleted,
    items: [
      { label: "새 그룹", value: 0, problem: false },
      { label: "새 레이어", value: created, problem: false },
      { label: "업데이트", value: updated, problem: false },
      { label: "누락", value: 0, problem: false },
      { label: "삭제 대기", value: deleted, problem: false },
      { label: "문제", value: deleted, problem: true },
    ],
  };
}

function movePreviewPlan(options: {
  controller: LayerDocumentLibraryController;
  plan: LayerDocumentPsdImportPreviewPlan;
  draggedId: string;
  targetId: string | null;
  position: "before" | "inside" | "after";
}) {
  const target = options.targetId
    ? options.plan.nodes.find(
        (node) => node.layerDocumentId === options.targetId
      )
    : null;
  const rootId =
    options.plan.prepared.command.selectLayerDocumentId;
  const parentLayerDocumentId =
    options.position === "inside"
      ? target?.layerDocumentId ?? rootId
      : target?.parentLayerDocumentId ?? rootId;
  const siblings = options.plan.nodes
    .filter((node) =>
      node.layerDocumentId !== options.draggedId &&
      node.parentLayerDocumentId === parentLayerDocumentId
    )
    .sort((left, right) => left.order - right.order);
  const targetIndex = target
    ? siblings.findIndex((node) =>
        node.layerDocumentId === target.layerDocumentId
      )
    : siblings.length;
  const toIndex =
    options.position === "after"
      ? targetIndex + 1
      : options.position === "before"
        ? targetIndex
        : siblings.length;
  return options.controller.moveImportPreviewNode(
    options.plan,
    {
      layerDocumentId: options.draggedId,
      parentLayerDocumentId,
      toIndex: Math.max(0, toIndex),
    }
  );
}

export function useLayerDocumentLibraryEngine(options: {
  controller: LayerDocumentLibraryController;
  audioImport: {
    prepare: (file: File) => Promise<PreparedLayerDocumentAudioImport>;
    confirm: (prepared: PreparedLayerDocumentAudioImport) => { readonly ok: boolean; readonly message?: string };
    cancel: (prepared: PreparedLayerDocumentAudioImport) => unknown;
  };
  audio: {
    read: () => import("@/editor/audio-runtime").EditorAudioAuditionState;
    subscribe: (listener: () => void) => () => void;
    readSelectedLayerDocumentId: () => string | null;
    select: (layerDocumentId: string) => void;
    togglePlayback: (layerDocumentId: string) => void;
    toggleMuted: (layerDocumentId: string) => void;
    rename: (layerDocumentId: string, name: string) => void;
    delete: (layerDocumentId: string) => void;
  };
  parentLayerDocumentId: string;
  durationFrames: number;
  parentWidth: number;
  parentHeight: number;
  nextOrder: () => number;
  cacheContext: () => SourceRegistryCacheInvalidationContext;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRequest = useRef(0);
  const activeAudioPrepared = useRef<PreparedLayerDocumentAudioImport | null>(null);
  const audioImportRef = useRef(options.audioImport);
  useEffect(() => {
    audioImportRef.current = options.audioImport;
  }, [options.audioImport]);
  const [picker, setPicker] = useState<
    { kind: "import" } |
    { kind: "refresh"; sourceId: string } |
    null
  >(null);
  const [plans, setPlans] = useState<
    readonly LayerDocumentPsdImportPreviewPlan[]
  >([]);
  const [status, setStatus] = useState<
    "idle" | "analyzing" | "review" | "importing"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] =
    useState<PsdRefreshSummaryViewModel | null>(null);
  const pendingExternalImport = useRef<
    ((imported: boolean) => void) | null
  >(null);
  const session = useMemo<
    LayerDocumentPsdPreparedSessionController
  >(() => createLayerDocumentPsdPreparedSessionController({
    cancelImport: options.controller.cancelImport,
    cancelRefresh: options.controller.cancelRefresh,
  }), [options.controller]);
  useEffect(
    () => () => {
      audioRequest.current += 1;
      if (activeAudioPrepared.current) {
        audioImportRef.current.cancel(activeAudioPrepared.current);
        activeAudioPrepared.current = null;
      }
      session.cancelActive();
      pendingExternalImport.current?.(false);
      pendingExternalImport.current = null;
    },
    [session]
  );

  const prepareImports = useCallback(async (
    files: readonly File[]
  ) => {
    const sequence = session.begin();
    setStatus("analyzing");
    setError(null);
    const prepared: LayerDocumentPsdImportPreviewPlan[] = [];
    try {
      for (const [index, file] of files.entries()) {
        prepared.push(await options.controller.prepareImport({
          file,
          token:
            `ui:${sequence}:${index}:${file.name}`,
          parentLayerDocumentId:
            options.parentLayerDocumentId,
          order: options.nextOrder() + index,
          durationFrames: options.durationFrames,
          parentWidth: options.parentWidth,
          parentHeight: options.parentHeight,
        }));
        if (sequence !== session.readSequence()) {
          prepared.forEach(options.controller.cancelImport);
          return false;
        }
      }
    } catch {
      prepared.forEach(options.controller.cancelImport);
      if (sequence === session.readSequence()) {
        setStatus("idle");
        setError("PSD 분석에 실패했습니다.");
      }
      return false;
    }
    const accepted =
      session.acceptImports(sequence, prepared);
    if (!accepted.accepted) return false;
    setPlans(prepared);
    setStatus(prepared.length ? "review" : "idle");
    return prepared.length > 0;
  }, [options, session]);

  const prepareRefresh = useCallback(async (
    sourceId: string,
    file: File
  ) => {
    const source =
      options.controller.sourceForRefresh(sourceId);
    if (!source) return;
    const sequence = session.begin();
    setError(null);
    try {
      const plan = await options.controller.prepareRefresh({
        file,
        documentSource: source,
        existingSources: Object.values(
          options.controller.readProject()
            .payload.sourceRegistry.sourcesById
        ),
      });
      const accepted =
        session.acceptRefresh(sequence, plan);
      if (!accepted.accepted) return;
      let result = options.controller.confirmRefresh(
        plan,
        options.cacheContext()
      );
      if (
        !result.ok &&
        plan.prepared.runtime.readState() ===
          "runtime-registration-pending"
      ) {
        result = options.controller.confirmRefresh(
          plan,
          options.cacheContext()
        );
      }
      if (!result.ok) {
        setError("PSD 새로고침에 실패했습니다.");
        return;
      }
      const active = session.read();
      if (active) session.clearTransferred(active);
      setSummary(refreshSummary(
        source.displayName,
        plan.summary
      ));
    } catch {
      if (sequence === session.readSequence()) {
        setError("PSD 새로고침 분석에 실패했습니다.");
      }
    }
  }, [options, session]);

  const onFileInputChange = useCallback((
    files: FileList | readonly File[]
  ) => {
    const selected = Array.from(files);
    if (picker?.kind === "refresh") {
      const file = selected[0];
      if (file) void prepareRefresh(picker.sourceId, file);
    } else if (selected.length) {
      void prepareImports(selected);
    }
    setPicker(null);
  }, [picker, prepareImports, prepareRefresh]);

  const cancel = useCallback(() => {
    session.cancelActive();
    setPlans([]);
    setStatus("idle");
    setError(null);
    pendingExternalImport.current?.(false);
    pendingExternalImport.current = null;
  }, [session]);
  const confirm = useCallback(async () => {
    const active = session.read();
    if (active?.kind !== "imports") return;
    setStatus("importing");
    let remaining = [...active.plans];
    while (remaining.length > 0) {
      const plan = remaining[0];
      let result = options.controller.confirmImport(plan);
      if (
        !result.ok &&
        plan.prepared.runtime.readState() ===
          "runtime-registration-pending"
      ) {
        result = options.controller.confirmImport(plan);
      }
      if (!result.ok) {
        setStatus("review");
        setError("PSD 불러오기에 실패했습니다.");
        return;
      }
      remaining = remaining.slice(1);
      session.replaceActiveImports(remaining);
      setPlans(remaining);
    }
    const completed = session.read();
    if (completed) session.clearTransferred(completed);
    setPlans([]);
    setStatus("idle");
    setError(null);
    pendingExternalImport.current?.(true);
    pendingExternalImport.current = null;
  }, [options.controller, session]);

  const moveNode = useCallback((
    token: string,
    draggedId: string,
    targetId: string | null,
    position: "before" | "inside" | "after"
  ) => {
    const next = plans.map((plan) =>
      previewToken(plan) === token
        ? movePreviewPlan({
            controller: options.controller,
            plan,
            draggedId,
            targetId,
            position,
          })
        : plan
    );
    session.replaceActiveImports(next);
    setPlans(next);
  }, [options.controller, plans, session]);

  const scaleImport = useCallback((
    token: string,
    scalePercent: number
  ) => {
    const next = plans.map((plan) =>
      previewToken(plan) === token
        ? options.controller.scaleImportPreview(
            plan,
            scalePercent
          )
        : plan
    );
    session.replaceActiveImports(next);
    setPlans(next);
  }, [options.controller, plans, session]);

  const renameImportNode = useCallback((
    token: string,
    layerDocumentId: string,
    name: string
  ) => {
    const next = plans.map((plan) =>
      previewToken(plan) === token
        ? options.controller.renameImportPreviewNode(
            plan,
            layerDocumentId,
            name
          )
        : plan
    );
    session.replaceActiveImports(next);
    setPlans(next);
  }, [options.controller, plans, session]);

  const removeImportNode = useCallback((
    token: string,
    layerDocumentId: string
  ) => {
    const next = plans.map((plan) =>
      previewToken(plan) === token
        ? options.controller.removeImportPreviewNode(
            plan,
            layerDocumentId
          )
        : plan
    );
    session.replaceActiveImports(next);
    setPlans(next);
  }, [options.controller, plans, session]);


  const playingLayerDocumentId = useSyncExternalStore(
    options.audio.subscribe,
    () => {
      const state = options.audio.read();
      return state.status === "playing" ? state.layerDocumentId : null;
    },
    () => null
  );
  const nodes = buildLayerDocumentLibraryNodes(options.controller, {
    selectedLayerDocumentId: options.audio.readSelectedLayerDocumentId(),
    playingLayerDocumentId,
  });
  const viewProps: LibraryViewProps = {
    nodes,
    fileInputRef,
    audioFileInputRef,
    draggedMainCompId: null,
    dropTarget: null,
    importPlan:
      plans.length
        ? buildLayerDocumentPsdImportViewPlan(plans)
        : null,
    importPreviewStatus: status,
    importPreviewError: error,
    refreshSummary: summary,
    onImportClick: () => {
      setPicker({ kind: "import" });
      fileInputRef.current?.click();
    },
    onFileInputChange,
    onAudioImportClick: () => audioFileInputRef.current?.click(),
    onAudioFileInputChange: (files) => {
      const file = Array.from(files)[0];
      if (!file) return;
      const request = ++audioRequest.current;
      if (activeAudioPrepared.current) {
        options.audioImport.cancel(activeAudioPrepared.current);
        activeAudioPrepared.current = null;
      }
      setError(null);
      void options.audioImport.prepare(file).then((prepared) => {
        if (request !== audioRequest.current) {
          options.audioImport.cancel(prepared);
          return;
        }
        activeAudioPrepared.current = prepared;
        const result = options.audioImport.confirm(prepared);
        if (result.ok) activeAudioPrepared.current = null;
        else setError(result.message ?? "오디오를 추가하지 못했습니다.");
      }).catch((reason: unknown) => {
        if (request === audioRequest.current) {
          setError(reason instanceof Error ? reason.message : "오디오를 분석하지 못했습니다.");
        }
      });
    },
    onSelectNode: (nodeId) => {
      const findNode = (items: readonly LibraryNodeViewModel[]): LibraryNodeViewModel | null => {
        for (const item of items) {
          if (item.id === nodeId) return item;
          const child = findNode(item.children);
          if (child) return child;
        }
        return null;
      };
      const node = findNode(nodes);
      if (node?.type === "project") {
        options.controller.openProject();
        return;
      }
      if (node?.contentKind === "audio" && node.layerDocumentId) {
        options.audio.select(node.layerDocumentId);
        return;
      }
      options.controller.selectSource(nodeId);
    },
    onToggleNodeVisibility: (nodeId) => {
      const audioNode = nodes.flatMap((node) => node.children).find((node) => node.id === nodeId && node.contentKind === "audio");
      if (audioNode) options.audio.toggleMuted(nodeId);
      else options.controller.toggleSourceVisibility(nodeId);
    },
    onToggleNodeLock: options.controller.toggleSourceLock,
    onToggleNodePlayback: options.audio.togglePlayback,
    onRenameNode: (nodeId, name) => {
      const audioNode = nodes.flatMap((node) => node.children).find((node) => node.id === nodeId && node.contentKind === "audio");
      if (audioNode) options.audio.rename(nodeId, name);
      else options.controller.renameSourceLayer(nodeId, name);
    },
    onDeleteNode: (nodeId) => {
      const audioNode = nodes.flatMap((node) => node.children).find((node) => node.id === nodeId && node.contentKind === "audio");
      if (audioNode) options.audio.delete(nodeId);
      else options.controller.deleteSourceLayer(nodeId);
    },
    onRefreshMainComp: (sourceId) => {
      setPicker({ kind: "refresh", sourceId });
      fileInputRef.current?.click();
    },
    onDeleteMainComp: (sourceId) => {
      options.controller.deleteSource({ sourceId });
    },
    onBeginMainDrag: () => {},
    onDragOverMain: () => false,
    onDropMain: () => {},
    onEndMainDrag: () => {},
    onCancelImport: cancel,
    onConfirmImport: () => {
      void confirm();
    },
    onMoveImportNode: moveNode,
    onScaleImport: scaleImport,
    onRenameImportNode: renameImportNode,
    onRemoveImportNode: removeImportNode,
    onDismissRefreshSummary: () => setSummary(null),
  };
  const importFiles = useCallback(
    async (files: readonly File[]) => {
      pendingExternalImport.current?.(false);
      pendingExternalImport.current = null;
      const prepared = await prepareImports(files);
      if (!prepared) return false;
      return new Promise<boolean>((resolve) => {
        pendingExternalImport.current = resolve;
      });
    },
    [prepareImports]
  );
  return { viewProps, session, importFiles };
}
