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
import {
  copyFilesIntoProjectAssets,
  deleteRecordedAudioProjectAsset,
} from "@/editor/projectAssetDirectoryRuntime";

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

export function buildLayerDocumentLibraryNodes(
  controller: LayerDocumentLibraryController,
  audioState?: {
    readonly selectedLayerDocumentId: string | null;
    readonly playingLayerDocumentId: string | null;
  },
  readPreview?: (
    layerDocumentId: string
  ) => ReturnType<NonNullable<LibraryNodeViewModel["preview"]>>
): LibraryNodeViewModel[] {
  const tree = controller.read();
  const project = controller.readProject();
  const projectRoot = Object.values(
    project.payload.layerDocumentsById
  ).find((layer) =>
    layer.type === "group" &&
    layer.data.role === "project-root"
  );
  const statusBySourceId = new Map<string, LibraryNodeViewModel["sourceSyncStatus"]>();
  const collectSourceStatus = (items: readonly { sourceId: string; refreshStatus: LibraryNodeViewModel["sourceSyncStatus"]; children?: readonly unknown[] }[]) => {
    items.forEach((item) => {
      statusBySourceId.set(item.sourceId, item.refreshStatus);
      collectSourceStatus((item.children ?? []) as readonly { sourceId: string; refreshStatus: LibraryNodeViewModel["sourceSyncStatus"]; children?: readonly unknown[] }[]);
    });
  };
  collectSourceStatus(tree.documents);
  collectSourceStatus(tree.orphanNodes);
  collectSourceStatus(tree.nonPsdSources);
  const audioTreeStatus = new Map(
    tree.nonPsdSources
      .filter((source) => source.kind === "audio")
      .map((source) => [source.sourceId, source.refreshStatus])
  );
  const layers = project.payload.layerDocumentsById;
  const childrenByParent = new Map<string, typeof layers[string][]>();
  Object.values(layers).forEach((layer) => {
    const parentId = layer.common.placement.parentLayerDocumentId;
    if (!parentId) return;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(layer);
    childrenByParent.set(parentId, siblings);
  });
  childrenByParent.forEach((siblings) => siblings.sort((left, right) =>
    left.common.placement.order - right.common.placement.order ||
    left.layerDocumentId.localeCompare(right.layerDocumentId)
  ));
  const buildLayerNode = (layer: typeof layers[string], depth: number): LibraryNodeViewModel => {
    const sourceId = layer.common.source?.sourceId ?? null;
    const source = sourceId ? project.payload.sourceRegistry.sourcesById[sourceId] : null;
    const isAudio = layer.type === "audio";
    const isCut = layer.type === "group" && layer.data.role === "composition" &&
      layer.common.placement.parentLayerDocumentId === projectRoot?.layerDocumentId;
    return {
      id: layer.layerDocumentId,
      type: isCut ? "main" : "sub",
      entityKind: layer.type === "group" ? "composition" : "layer",
      contentKind: isAudio ? "audio" : "visual",
      audioProvenance: isAudio && source?.kind === "audio" ? source.data.provenance : null,
      playing: isAudio && audioState?.playingLayerDocumentId === layer.layerDocumentId,
      muted: isAudio ? layer.data.muted : false,
      sourceId,
      layerDocumentId: layer.layerDocumentId,
      name: layer.name,
      depth,
      selected: isAudio
        ? audioState?.selectedLayerDocumentId === layer.layerDocumentId
        : sourceId !== null && tree.selectedSourceId === sourceId,
      visible: isAudio ? !layer.data.muted : layer.common.placement.visible,
      locked: !!layer.common.placement.locked,
      sourceSyncStatus: sourceId
        ? statusBySourceId.get(sourceId) ?? (isAudio ? audioTreeStatus.get(sourceId) ?? "missing" : "normal")
        : "normal",
      canRefresh: isCut && source?.kind === "psd-document",
      canDelete: !isCut || source?.kind === "psd-document",
      canReorder: true,
      preview: readPreview
        ? () => readPreview(layer.layerDocumentId)
        : null,
      children: (childrenByParent.get(layer.layerDocumentId) ?? [])
        .map((child) => buildLayerNode(child, depth + 1)),
    };
  };
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
        preview: null,
        children: [],
      }]
    : [];
  const hierarchy = projectRoot
    ? (childrenByParent.get(projectRoot.layerDocumentId) ?? [])
        .map((layer) => buildLayerNode(layer, layer.type === "group" && layer.data.role === "composition" ? 0 : 1))
    : [];
  return [...projectNode, ...hierarchy];
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
    prepare: (
      file: File,
      relativePathHint?: string | null,
      order?: number
    ) => Promise<PreparedLayerDocumentAudioImport>;
    confirm: (prepared: PreparedLayerDocumentAudioImport) => { readonly ok: boolean; readonly message?: string };
    cancel: (prepared: PreparedLayerDocumentAudioImport) => unknown;
  };
  audioRecording: {
    start: () => Promise<import("@/engines/project").LayerDocumentAudioRecordingSession>;
    stop: (session: import("@/engines/project").LayerDocumentAudioRecordingSession) => Promise<PreparedLayerDocumentAudioImport>;
    cancel: (session: import("@/engines/project").LayerDocumentAudioRecordingSession) => boolean;
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
    move: (command: {
      layerDocumentId: string;
      targetLayerDocumentId: string;
      position: "before" | "inside" | "after";
    }) => void;
  };
  preview?: {
    read: (
      layerDocumentId: string
    ) => ReturnType<NonNullable<LibraryNodeViewModel["preview"]>>;
  };
  parentLayerDocumentId: string;
  durationFrames: number;
  parentWidth: number;
  parentHeight: number;
  nextOrder: () => number;
  cacheContext: () => SourceRegistryCacheInvalidationContext;
  resetRevision: number;
}) {
  const findLibraryNode = (
    items: readonly LibraryNodeViewModel[],
    nodeId: string
  ): LibraryNodeViewModel | null => {
    for (const item of items) {
      if (item.id === nodeId) return item;
      const child = findLibraryNode(item.children, nodeId);
      if (child) return child;
    }
    return null;
  };
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRequest = useRef(0);
  const activeAudioPrepared = useRef<PreparedLayerDocumentAudioImport[]>([]);
  const activeRecording = useRef<import("@/engines/project").LayerDocumentAudioRecordingSession | null>(null);
  const [audioRecordingStatus, setAudioRecordingStatus] = useState<LibraryViewProps["audioRecordingStatus"]>("idle");
  const [audioRecordingName, setAudioRecordingName] = useState<string | null>(null);
  const [assetCopyPrompt, setAssetCopyPrompt] = useState<LibraryViewProps["assetCopyPrompt"]>(null);
  const assetCopyResolver = useRef<((copy: boolean) => void) | null>(null);
  const requestAssetCopy = useCallback((kind: "psd" | "audio", fileCount: number) =>
    new Promise<boolean>((resolve) => {
      assetCopyResolver.current?.(false);
      assetCopyResolver.current = resolve;
      setAssetCopyPrompt({ kind, fileCount });
    }), []);
  const projectIdentity = `${options.controller.readProject().metadata.projectId}:${options.resetRevision}`;
  const previousProjectIdentity = useRef(projectIdentity);
  const audioImportRef = useRef(options.audioImport);
  const audioRecordingRef = useRef(options.audioRecording);
  useEffect(() => {
    audioImportRef.current = options.audioImport;
    audioRecordingRef.current = options.audioRecording;
  }, [options.audioImport, options.audioRecording]);
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
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<import("@/engines/library/models/libraryModel").LibraryDropTarget>(null);
  const dropTargetRef = useRef<import("@/engines/library/models/libraryModel").LibraryDropTarget>(null);
  const dragCandidateRef = useRef<{
    targetId: string;
    position: "before" | "inside" | "after";
    since: number;
  } | null>(null);
  const replaceDropTarget = (
    next: import("@/engines/library/models/libraryModel").LibraryDropTarget
  ) => {
    const current = dropTargetRef.current;
    if (
      current?.targetId === next?.targetId &&
      current?.position === next?.position
    ) return;
    dropTargetRef.current = next;
    setDropTarget(next);
  };
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
      activeAudioPrepared.current.forEach(audioImportRef.current.cancel);
      activeAudioPrepared.current = [];
      if (activeRecording.current) {
        audioRecordingRef.current.cancel(activeRecording.current);
        activeRecording.current = null;
      }
      session.cancelActive();
      pendingExternalImport.current?.(false);
      pendingExternalImport.current = null;
      assetCopyResolver.current?.(false);
      assetCopyResolver.current = null;
    },
    [session]
  );
  useEffect(() => {
    if (previousProjectIdentity.current === projectIdentity) return;
    previousProjectIdentity.current = projectIdentity;
    audioRequest.current += 1;
    if (activeRecording.current) {
      audioRecordingRef.current.cancel(activeRecording.current);
      activeRecording.current = null;
    }
    activeAudioPrepared.current.forEach(audioImportRef.current.cancel);
    activeAudioPrepared.current = [];
    assetCopyResolver.current?.(false);
    assetCopyResolver.current = null;
    const resetTimer = window.setTimeout(() => {
      setAudioRecordingStatus("idle");
      setAudioRecordingName(null);
      setAssetCopyPrompt(null);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [projectIdentity]);

  const prepareImports = useCallback(async (
    files: readonly { file: File; relativePathHint: string | null }[]
  ) => {
    const sequence = session.begin();
    setStatus("analyzing");
    setError(null);
    const prepared: LayerDocumentPsdImportPreviewPlan[] = [];
    try {
      for (const [index, entry] of files.entries()) {
        const file = entry.file;
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
          relativePathHint: entry.relativePathHint,
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
      void requestAssetCopy("psd", selected.length)
        .then((copy) => copyFilesIntoProjectAssets({ files: selected, kind: "psd", copy }))
        .then((copied) => prepareImports(copied))
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "PSD 파일 복사에 실패했습니다."));
    }
    setPicker(null);
  }, [picker, prepareImports, prepareRefresh, requestAssetCopy]);

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
  }, options.preview?.read);
  const viewProps: LibraryViewProps = {
    nodes,
    fileInputRef,
    audioFileInputRef,
    draggedMainCompId: draggedNodeId,
    dropTarget,
    importPlan:
      plans.length
        ? buildLayerDocumentPsdImportViewPlan(plans)
        : null,
    importPreviewStatus: status,
    importPreviewError: error,
    refreshSummary: summary,
    audioRecordingStatus,
    audioRecordingName,
    assetCopyPrompt,
    onImportClick: () => {
      setPicker({ kind: "import" });
      fileInputRef.current?.click();
    },
    onFileInputChange,
    onAudioImportClick: () => audioFileInputRef.current?.click(),
    onAudioFileInputChange: (files) => {
      const selectedFiles = Array.from(files);
      if (selectedFiles.length === 0) return;
      const request = ++audioRequest.current;
      activeAudioPrepared.current.forEach(options.audioImport.cancel);
      activeAudioPrepared.current = [];
      setError(null);
      void (async () => {
        const copy = await requestAssetCopy("audio", selectedFiles.length);
        const imports = await copyFilesIntoProjectAssets({ files: selectedFiles, kind: "audio", copy });
        const preparedImports: PreparedLayerDocumentAudioImport[] = [];
        let nextOrder: number | undefined;
        for (const entry of imports) {
          const prepared = await options.audioImport.prepare(
            entry.file,
            entry.relativePathHint,
            nextOrder
          );
          if (request !== audioRequest.current) {
            options.audioImport.cancel(prepared);
            preparedImports.forEach(options.audioImport.cancel);
            return;
          }
          preparedImports.push(prepared);
          nextOrder = prepared.command.layers[0].common.placement.order + 1;
          activeAudioPrepared.current = [...preparedImports];
        }
        for (const prepared of preparedImports) {
          const result = options.audioImport.confirm(prepared);
          if (!result.ok) {
            preparedImports
              .filter((candidate) => candidate !== prepared)
              .forEach(options.audioImport.cancel);
            activeAudioPrepared.current = [];
            setError(result.message ?? `${prepared.file.name} 파일을 추가하지 못했습니다.`);
            return;
          }
          activeAudioPrepared.current = activeAudioPrepared.current
            .filter((candidate) => candidate !== prepared);
        }
      })().catch((reason: unknown) => {
        if (request === audioRequest.current) {
          setError(reason instanceof Error ? reason.message : "오디오를 분석하지 못했습니다.");
        }
      });
    },
    onStartAudioRecording: () => {
      if (audioRecordingStatus !== "idle") return;
      setError(null);
      setAudioRecordingStatus("requesting");
      const request = ++audioRequest.current;
      void options.audioRecording.start().then((recording) => {
        if (request !== audioRequest.current) {
          options.audioRecording.cancel(recording);
          return;
        }
        activeRecording.current = recording;
        setAudioRecordingStatus("recording");
      }).catch((reason: unknown) => {
        if (request === audioRequest.current) {
          setAudioRecordingStatus("idle");
          setError(reason instanceof Error ? reason.message : "마이크를 시작하지 못했습니다.");
        }
      });
    },
    onStopAudioRecording: () => {
      const recording = activeRecording.current;
      if (!recording || audioRecordingStatus !== "recording") return;
      setAudioRecordingStatus("preparing");
      const request = audioRequest.current;
      void options.audioRecording.stop(recording).then(async (prepared) => {
        if (request !== audioRequest.current) {
          options.audioImport.cancel(prepared);
          return;
        }
        const copied = await copyFilesIntoProjectAssets({
          files: [prepared.file],
          kind: "audio",
          copy: true,
        });
        const stored = copied[0];
        if (!stored?.relativePathHint) {
          options.audioImport.cancel(prepared);
          throw new Error("녹음 파일을 프로젝트의 audio 폴더에 저장하지 못했습니다.");
        }
        const storedPrepared: PreparedLayerDocumentAudioImport = {
          ...prepared,
          file: stored.file,
          command: {
            ...prepared.command,
            sources: prepared.command.sources.map((source) =>
              source.kind === "audio"
                ? {
                    ...source,
                    locator: {
                      ...source.locator,
                      suggestedFileName: stored.file.name,
                      relativePathHint: stored.relativePathHint,
                    },
                  }
                : source
            ),
          },
        };
        if (request !== audioRequest.current) {
          options.audioImport.cancel(storedPrepared);
          return;
        }
        activeAudioPrepared.current = [storedPrepared];
        if (activeRecording.current === recording) activeRecording.current = null;
        setAudioRecordingName(storedPrepared.command.layers[0]?.name ?? "움직 녹음");
        setAudioRecordingStatus("review");
      }).catch((reason: unknown) => {
        if (request === audioRequest.current) {
          if (activeRecording.current === recording) activeRecording.current = null;
          setAudioRecordingStatus("idle");
          setError(reason instanceof Error ? reason.message : "녹음을 준비하지 못했습니다.");
        }
      });
    },
    onCancelAudioRecording: () => {
      audioRequest.current += 1;
      if (activeRecording.current) {
        options.audioRecording.cancel(activeRecording.current);
        activeRecording.current = null;
      }
      activeAudioPrepared.current.forEach(options.audioImport.cancel);
      activeAudioPrepared.current = [];
      setAudioRecordingName(null);
      setAudioRecordingStatus("idle");
      setError(null);
    },
    onConfirmAudioRecording: () => {
      const prepared = activeAudioPrepared.current[0];
      if (!prepared || audioRecordingStatus !== "review") return;
      const result = options.audioImport.confirm(prepared);
      if (result.ok) {
        activeAudioPrepared.current = [];
        setAudioRecordingName(null);
        setAudioRecordingStatus("idle");
      } else {
        setError(result.message ?? "녹음을 추가하지 못했습니다.");
      }
    },
    onResolveAssetCopy: (copy) => {
      const resolve = assetCopyResolver.current;
      assetCopyResolver.current = null;
      setAssetCopyPrompt(null);
      resolve?.(copy);
    },
    onSelectNode: (nodeId) => {
      const node = findLibraryNode(nodes, nodeId);
      if (node?.type === "project") {
        options.controller.openProject();
        return;
      }
      if (node?.contentKind === "audio" && node.layerDocumentId) {
        options.audio.select(node.layerDocumentId);
        return;
      }
      if (node?.type === "main" && node.sourceId) {
        options.controller.selectSource(node.sourceId);
        return;
      }
      if (node?.layerDocumentId) {
        options.controller.selectLayerDocument(node.layerDocumentId);
      }
    },
    onToggleNodeVisibility: (nodeId) => {
      const candidate = findLibraryNode(nodes, nodeId);
      const audioNode = candidate?.contentKind === "audio" ? candidate : null;
      if (audioNode) options.audio.toggleMuted(nodeId);
      else if (candidate?.layerDocumentId) options.controller.toggleLayerVisibility(candidate.layerDocumentId);
    },
    onToggleNodeLock: (nodeId) => {
      const node = findLibraryNode(nodes, nodeId);
      if (node?.layerDocumentId) options.controller.toggleLayerLock(node.layerDocumentId);
    },
    onToggleNodePlayback: options.audio.togglePlayback,
    onRenameNode: (nodeId, name) => {
      const candidate = findLibraryNode(nodes, nodeId);
      const audioNode = candidate?.contentKind === "audio" ? candidate : null;
      if (audioNode) options.audio.rename(nodeId, name);
      else if (candidate?.layerDocumentId) options.controller.renameLayerDocument(candidate.layerDocumentId, name);
    },
    onDeleteNode: (nodeId) => {
      const candidate = findLibraryNode(nodes, nodeId);
      const audioNode = candidate?.contentKind === "audio" ? candidate : null;
      if (audioNode) {
        const project = options.controller.readProject();
        const layer = project.payload.layerDocumentsById[nodeId];
        const sourceId = layer?.common.source?.sourceId ?? null;
        const source = sourceId
          ? project.payload.sourceRegistry.sourcesById[sourceId]
          : null;
        const referenceCount = sourceId
          ? Object.values(project.payload.layerDocumentsById)
              .filter((item) => item.common.source?.sourceId === sourceId).length
          : 0;
        const recordedAssetPath =
          source?.kind === "audio" &&
          source.data.provenance === "recorded" &&
          referenceCount === 1
            ? source.locator.relativePathHint
            : null;
        options.audio.delete(nodeId);
        const wasDeleted = !options.controller.readProject().payload.layerDocumentsById[nodeId];
        if (wasDeleted && recordedAssetPath) {
          void deleteRecordedAudioProjectAsset(recordedAssetPath)
            .then((deleted) => {
              if (!deleted) {
                setError("녹음 레이어는 삭제했지만 audio 폴더의 원본 파일은 지우지 못했습니다.");
              }
            })
            .catch(() => {
              setError("녹음 레이어는 삭제했지만 audio 폴더의 원본 파일은 지우지 못했습니다.");
            });
        }
      }
      else if (candidate?.layerDocumentId) options.controller.deleteLayerDocument(candidate.layerDocumentId);
    },
    onRefreshMainComp: (sourceId) => {
      setPicker({ kind: "refresh", sourceId });
      fileInputRef.current?.click();
    },
    onDeleteMainComp: (sourceId) => {
      options.controller.deleteSource({ sourceId });
    },
    onBeginMainDrag: (nodeId) => {
      setDraggedNodeId(nodeId);
      dragCandidateRef.current = null;
      replaceDropTarget(null);
    },
    onDragOverMain: (targetId, pointerY, nodeTop, nodeHeight) => {
      if (!draggedNodeId || draggedNodeId === targetId) return false;
      const all = (items: readonly LibraryNodeViewModel[]): LibraryNodeViewModel[] =>
        items.flatMap((item) => [item, ...all(item.children)]);
      const flat = all(nodes);
      const dragged = flat.find((node) => node.id === draggedNodeId);
      const target = flat.find((node) => node.id === targetId);
      if (!dragged?.canReorder || !target) return false;
      const valid = dragged.type === "main"
        ? target.type === "main"
        : target.type !== "project";
      if (!valid) return false;
      const relativeY = (pointerY - nodeTop) / Math.max(1, nodeHeight);
      const canContain = target.type === "main" || target.entityKind === "composition";
      const current = dropTargetRef.current;
      const position = (() => {
        if (current?.targetId === targetId) {
          if (current.position === "before" && relativeY < 0.42) return "before";
          if (current.position === "after" && relativeY > 0.58) return "after";
          if (
            current.position === "inside" &&
            canContain &&
            relativeY >= 0.2 &&
            relativeY <= 0.8
          ) return "inside";
        }
        return canContain && relativeY >= 0.3 && relativeY <= 0.7
          ? "inside"
          : relativeY < 0.5 ? "before" : "after";
      })();
      if (
        current?.targetId === targetId &&
        current.position === position
      ) {
        dragCandidateRef.current = null;
        return true;
      }
      const now = performance.now();
      const candidate = dragCandidateRef.current;
      if (
        candidate?.targetId !== targetId ||
        candidate.position !== position
      ) {
        dragCandidateRef.current = { targetId, position, since: now };
        return true;
      }
      if (now - candidate.since >= 120) {
        replaceDropTarget({ targetId, position });
        dragCandidateRef.current = null;
      }
      return true;
    },
    onDropMain: (targetId) => {
      if (!draggedNodeId || dropTarget?.targetId !== targetId) return;
      const all = (items: readonly LibraryNodeViewModel[]): LibraryNodeViewModel[] =>
        items.flatMap((item) => [item, ...all(item.children)]);
      const flat = all(nodes);
      const dragged = flat.find((node) => node.id === draggedNodeId);
      const target = flat.find((node) => node.id === targetId);
      if (dragged?.layerDocumentId && target?.layerDocumentId) {
        options.audio.move({
          layerDocumentId: dragged.layerDocumentId,
          targetLayerDocumentId: target.layerDocumentId,
          position: dropTarget.position,
        });
      }
      setDraggedNodeId(null);
      dragCandidateRef.current = null;
      replaceDropTarget(null);
    },
    onEndMainDrag: () => {
      setDraggedNodeId(null);
      dragCandidateRef.current = null;
      replaceDropTarget(null);
    },
    onMoveNodeKeyboard: (nodeId, direction) => {
      const all = (items: readonly LibraryNodeViewModel[]): LibraryNodeViewModel[] =>
        items.flatMap((item) => [item, ...all(item.children)]);
      const flat = all(nodes);
      const node = flat.find((candidate) => candidate.id === nodeId);
      if (!node?.layerDocumentId || !node.canReorder) return;
      const nodeLayerDocumentId = node.layerDocumentId;
      const projectParent = (layerDocumentId: string) =>
        options.controller.readProject().payload.layerDocumentsById[layerDocumentId]
          ?.common.placement.parentLayerDocumentId ?? null;
      const siblings = node.type === "main"
        ? nodes.filter((candidate) => candidate.type === "main" && candidate.canReorder)
        : flat.filter((candidate) => candidate.type !== "project" && candidate.depth === node.depth && candidate.layerDocumentId !== null && candidate !== node && projectParent(candidate.layerDocumentId) === projectParent(nodeLayerDocumentId));
      const ordered = node.type === "main" ? siblings : [node, ...siblings].sort((left, right) => {
        const a = left.layerDocumentId ? options.controller.readProject().payload.layerDocumentsById[left.layerDocumentId]?.common.placement.order ?? 0 : 0;
        const b = right.layerDocumentId ? options.controller.readProject().payload.layerDocumentsById[right.layerDocumentId]?.common.placement.order ?? 0 : 0;
        return a - b;
      });
      const index = ordered.findIndex((candidate) => candidate.id === nodeId);
      const target = ordered[index + direction];
      if (!target?.layerDocumentId) return;
      options.audio.move({ layerDocumentId: nodeLayerDocumentId, targetLayerDocumentId: target.layerDocumentId, position: direction < 0 ? "before" : "after" });
    },
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
      const prepared = await prepareImports(files.map((file) => ({ file, relativePathHint: null })));
      if (!prepared) return false;
      return new Promise<boolean>((resolve) => {
        pendingExternalImport.current = resolve;
      });
    },
    [prepareImports]
  );
  return { viewProps, session, importFiles };
}
