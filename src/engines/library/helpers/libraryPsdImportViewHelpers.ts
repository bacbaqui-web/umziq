import type {
  LayerDocumentLibraryController,
  LayerDocumentPsdImportPreviewPlan,
  PsdImportPlan,
  PsdImportPlanNode,
} from "@/engines/project";
import type { PsdRefreshSummaryViewModel } from "@/engines/library/models/libraryModel";

export function libraryPsdImportPreviewToken(
  plan: LayerDocumentPsdImportPreviewPlan
) {
  return plan.prepared.command.sources.find(
    (source) => source.kind === "psd-document"
  )?.sourceId ?? plan.prepared.fileName;
}

export function buildLibraryPsdImportPreviewTree(
  plan: LayerDocumentPsdImportPreviewPlan
): PsdImportPlanNode[] {
  const layerById = new Map(
    plan.prepared.command.layers.map((layer) => [layer.layerDocumentId, layer])
  );
  const nodeById = new Map(
    plan.nodes.map((node) => [node.layerDocumentId, node])
  );
  const sourceById = new Map(
    plan.prepared.command.sources.map((source) => [source.sourceId, source])
  );
  const build = (layerDocumentId: string): PsdImportPlanNode | null => {
    const layer = layerById.get(layerDocumentId);
    const node = nodeById.get(layerDocumentId);
    if (!layer || !node) return null;
    const sourceId = layer.common.source?.sourceId;
    const source = sourceId ? sourceById.get(sourceId) : null;
    const previewUrl =
      plan.prepared.previewImagesByLayerDocumentId?.[layer.layerDocumentId];
    const previewSize =
      plan.prepared.previewSizesByLayerDocumentId?.[layer.layerDocumentId];
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
      previewUrl: previewUrl || undefined,
      previewEmpty: previewUrl === "",
      previewWidth: previewSize?.width,
      previewHeight: previewSize?.height,
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
    .filter(
      (node) =>
        !node.parentLayerDocumentId || !ids.has(node.parentLayerDocumentId)
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
      token: libraryPsdImportPreviewToken(plan),
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
          plan.prepared.command.layers.find(
            (layer) =>
              layer.layerDocumentId ===
              plan.prepared.command.selectLayerDocumentId
          )?.name ?? plan.prepared.fileName.replace(/\.psd$/i, ""),
        hiddenLayerMode: "preserve",
      },
      tree: buildLibraryPsdImportPreviewTree(plan),
    })),
  };
}

export function buildLibraryPsdRefreshSummary(
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

export function moveLibraryPsdImportPreviewNode(options: {
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
  const rootId = options.plan.prepared.command.selectLayerDocumentId;
  const parentLayerDocumentId =
    options.position === "inside"
      ? target?.layerDocumentId ?? rootId
      : target?.parentLayerDocumentId ?? rootId;
  const siblings = options.plan.nodes
    .filter(
      (node) =>
        node.layerDocumentId !== options.draggedId &&
        node.parentLayerDocumentId === parentLayerDocumentId
    )
    .sort((left, right) => left.order - right.order);
  const targetIndex = target
    ? siblings.findIndex(
        (node) => node.layerDocumentId === target.layerDocumentId
      )
    : siblings.length;
  const toIndex =
    options.position === "after"
      ? targetIndex + 1
      : options.position === "before"
        ? targetIndex
        : siblings.length;
  return options.controller.moveImportPreviewNode(options.plan, {
    layerDocumentId: options.draggedId,
    parentLayerDocumentId,
    toIndex: Math.max(0, toIndex),
  });
}
