import type { LayerDocumentLibraryController } from "@/engines/project";
import type { LibraryNodeViewModel } from "@/engines/library/models/libraryModel";

export function flattenLibraryNodes(
  items: readonly LibraryNodeViewModel[]
): LibraryNodeViewModel[] {
  return items.flatMap((item) => [item, ...flattenLibraryNodes(item.children)]);
}

export function findLibraryNode(
  items: readonly LibraryNodeViewModel[],
  nodeId: string
): LibraryNodeViewModel | null {
  return flattenLibraryNodes(items).find((item) => item.id === nodeId) ?? null;
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
  const projectRoot = Object.values(project.payload.layerDocumentsById).find(
    (layer) => layer.type === "group" && layer.data.role === "project-root"
  );
  const statusBySourceId = new Map<
    string,
    LibraryNodeViewModel["sourceSyncStatus"]
  >();
  const collectSourceStatus = (
    items: readonly {
      sourceId: string;
      refreshStatus: LibraryNodeViewModel["sourceSyncStatus"];
      children?: readonly unknown[];
    }[]
  ) => {
    items.forEach((item) => {
      statusBySourceId.set(item.sourceId, item.refreshStatus);
      collectSourceStatus(
        (item.children ?? []) as readonly {
          sourceId: string;
          refreshStatus: LibraryNodeViewModel["sourceSyncStatus"];
          children?: readonly unknown[];
        }[]
      );
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
  const childrenByParent = new Map<string, (typeof layers)[string][]>();
  Object.values(layers).forEach((layer) => {
    const parentId = layer.common.placement.parentLayerDocumentId;
    if (!parentId) return;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(layer);
    childrenByParent.set(parentId, siblings);
  });
  childrenByParent.forEach((siblings) =>
    siblings.sort(
      (left, right) =>
        left.common.placement.order - right.common.placement.order ||
        left.layerDocumentId.localeCompare(right.layerDocumentId)
    )
  );
  const buildLayerNode = (
    layer: (typeof layers)[string],
    depth: number
  ): LibraryNodeViewModel => {
    const sourceId = layer.common.source?.sourceId ?? null;
    const source = sourceId
      ? project.payload.sourceRegistry.sourcesById[sourceId]
      : null;
    const isAudio = layer.type === "audio";
    const isCut =
      layer.type === "group" &&
      layer.data.role === "composition" &&
      layer.common.placement.parentLayerDocumentId ===
        projectRoot?.layerDocumentId;
    return {
      id: layer.layerDocumentId,
      type: isCut ? "main" : "sub",
      entityKind: layer.type === "group" ? "composition" : "layer",
      contentKind: isAudio ? "audio" : "visual",
      audioProvenance:
        isAudio && source?.kind === "audio" ? source.data.provenance : null,
      playing:
        isAudio &&
        audioState?.playingLayerDocumentId === layer.layerDocumentId,
      muted: isAudio ? layer.data.muted : false,
      sourceId,
      layerDocumentId: layer.layerDocumentId,
      name: layer.name,
      depth,
      selected: layer.type === "group"
        ? controller.readActiveGroupLayerDocumentId() === layer.layerDocumentId
        : audioState?.selectedLayerDocumentId === layer.layerDocumentId,
      visible: isAudio ? !layer.data.muted : layer.common.placement.visible,
      locked: Boolean(layer.common.placement.locked),
      sourceSyncStatus: sourceId
        ? statusBySourceId.get(sourceId) ??
          (isAudio ? audioTreeStatus.get(sourceId) ?? "missing" : "normal")
        : "normal",
      canRefresh: isCut && source?.kind === "psd-document",
      canDelete: !isCut || source?.kind === "psd-document",
      canReorder: true,
      preview: readPreview
        ? () => readPreview(layer.layerDocumentId)
        : null,
      children: (childrenByParent.get(layer.layerDocumentId) ?? []).map(
        (child) => buildLayerNode(child, depth + 1)
      ),
    };
  };
  const projectNode: LibraryNodeViewModel[] = projectRoot
    ? [
        {
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
        },
      ]
    : [];
  const hierarchy = projectRoot
    ? (childrenByParent.get(projectRoot.layerDocumentId) ?? []).map((layer) =>
        buildLayerNode(
          layer,
          layer.type === "group" && layer.data.role === "composition" ? 0 : 1
        )
      )
    : [];
  return [...projectNode, ...hierarchy];
}

export function findLibraryKeyboardMoveTarget(options: {
  nodes: readonly LibraryNodeViewModel[];
  nodeId: string;
  direction: -1 | 1;
  readParentId: (layerDocumentId: string) => string | null;
  readOrder: (layerDocumentId: string) => number;
}): LibraryNodeViewModel | null {
  const flat = flattenLibraryNodes(options.nodes);
  const node = flat.find((candidate) => candidate.id === options.nodeId);
  if (!node?.layerDocumentId || !node.canReorder) return null;
  const siblings =
    node.type === "main"
      ? options.nodes.filter(
          (candidate) => candidate.type === "main" && candidate.canReorder
        )
      : flat.filter(
          (candidate) =>
            candidate.type !== "project" &&
            candidate.depth === node.depth &&
            candidate.layerDocumentId !== null &&
            candidate !== node &&
            options.readParentId(candidate.layerDocumentId) ===
              options.readParentId(node.layerDocumentId as string)
        );
  const ordered =
    node.type === "main"
      ? siblings
      : [node, ...siblings].sort((left, right) =>
          options.readOrder(left.layerDocumentId as string) -
          options.readOrder(right.layerDocumentId as string)
        );
  const index = ordered.findIndex((candidate) => candidate.id === node.id);
  return ordered[index + options.direction] ?? null;
}
