import type {
  LayerDocument,
  LayerDocumentProject,
  PsdDocumentSourceRecord,
  PsdTreeSourceSelection,
  SourceRegistryRecord,
} from "@/models";
import {
  layerDocumentSourceDescriptorPath,
  layerDocumentSourceVisualFingerprint,
} from "@/models";
import {
  prepareLayerDocumentPsdImport,
  prepareLayerDocumentPsdRefresh,
  type PreparedLayerDocumentPsdImport,
  type PreparedLayerDocumentPsdRefresh,
} from "@/engines/project/import/layerDocumentPsdImportAdapter";
import type {
  DeleteSourceRegistryCommand,
  PsdSourceTreeReadModel,
  ReconnectSourceRegistryCommand,
  RefreshSourceRegistryCommand,
  SourceRegistryCacheInvalidationContext,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";

export interface LayerDocumentPsdTreeCommandPort {
  readonly readTree: () => PsdSourceTreeReadModel;
  readonly readProject: () => LayerDocumentProject;
  readonly selectSource: (
    selection: PsdTreeSourceSelection | null
  ) => unknown;
  readonly toggleSourceVisibility: (sourceId: string) => unknown;
  readonly toggleSourceLock: (sourceId: string) => unknown;
  readonly renameSourceLayer: (sourceId: string, name: string) => unknown;
  readonly deleteSourceLayer: (sourceId: string) => unknown;
  readonly openProject: () => unknown;
  readonly readActiveGroupLayerDocumentId: () => string;
  readonly confirmImport: (
    prepared: PreparedLayerDocumentPsdImport
  ) => { readonly ok: boolean };
  readonly cancelImport: (
    prepared: PreparedLayerDocumentPsdImport
  ) => unknown;
  readonly confirmRefresh: (
    prepared: PreparedLayerDocumentPsdRefresh,
    cacheContext: SourceRegistryCacheInvalidationContext
  ) => { readonly ok: boolean };
  readonly cancelRefresh: (
    prepared: PreparedLayerDocumentPsdRefresh
  ) => unknown;
  readonly refreshSource: (
    command: RefreshSourceRegistryCommand
  ) => unknown;
  readonly reconnect: (
    command: ReconnectSourceRegistryCommand
  ) => unknown;
  readonly deleteSource: (
    command: DeleteSourceRegistryCommand
  ) => { readonly ok: boolean };
}

export interface LayerDocumentPsdImportPreviewNode {
  readonly layerDocumentId: string;
  readonly parentLayerDocumentId: string | null;
  readonly order: number;
  readonly canContainChildren: boolean;
}

export interface LayerDocumentPsdImportPreviewPlan {
  readonly prepared: PreparedLayerDocumentPsdImport;
  readonly nodes: readonly LayerDocumentPsdImportPreviewNode[];
  readonly scalePercent: number;
}

export interface LayerDocumentPsdRefreshDiffSummary {
  readonly documentSourceId: string;
  readonly updatedSourceIds: readonly string[];
  readonly newSourceIds: readonly string[];
  readonly deletePendingSourceIds: readonly string[];
}

export interface PreparedLayerDocumentPsdRefreshPlan {
  readonly prepared: PreparedLayerDocumentPsdRefresh;
  readonly summary: LayerDocumentPsdRefreshDiffSummary;
}

function normalizeSiblingOrders(
  nodes: readonly LayerDocumentPsdImportPreviewNode[],
  parentLayerDocumentId: string | null
) {
  const siblings = nodes
    .filter((node) =>
      node.parentLayerDocumentId === parentLayerDocumentId
    )
    .sort((left, right) => left.order - right.order);
  const orderById = new Map(
    siblings.map((node, order) => [node.layerDocumentId, order])
  );
  return nodes.map((node) =>
    orderById.has(node.layerDocumentId)
      ? { ...node, order: orderById.get(node.layerDocumentId) ?? node.order }
      : node
  );
}

function createImportPreviewPlan(
  prepared: PreparedLayerDocumentPsdImport
): LayerDocumentPsdImportPreviewPlan {
  return {
    prepared,
    scalePercent: 100,
    nodes: prepared.command.layers.map((layer) => ({
      layerDocumentId: layer.layerDocumentId,
      parentLayerDocumentId:
        layer.common.placement.parentLayerDocumentId,
      order: layer.common.placement.order,
      canContainChildren: layer.type === "group",
    })),
  };
}

function scaleImportPreviewPlan(
  plan: LayerDocumentPsdImportPreviewPlan,
  scalePercent: number
): LayerDocumentPsdImportPreviewPlan {
  if (
    !Number.isFinite(scalePercent) ||
    scalePercent < 1 ||
    scalePercent > 400 ||
    scalePercent === plan.scalePercent
  ) return plan;
  const ratio = scalePercent / plan.scalePercent;
  const compositionId =
    plan.prepared.command.selectLayerDocumentId;
  const scalePoint = (point: { x: number; y: number }) => ({
    x: point.x * ratio,
    y: point.y * ratio,
  });
  const layers = plan.prepared.command.layers.map((layer) => {
    if (
      layer.layerDocumentId === compositionId &&
      layer.type === "group"
    ) {
      const width = Math.max(1, Math.round(layer.data.width * ratio));
      const height = Math.max(1, Math.round(layer.data.height * ratio));
      return {
        ...layer,
        common: {
          ...layer.common,
          transform: {
            ...layer.common.transform,
            anchor: {
              x: width / 2,
              y: height / 2,
            },
          },
        },
        data: {
          ...layer.data,
          width,
          height,
        },
      } as LayerDocument;
    }
    if (
      layer.common.placement.parentLayerDocumentId !==
      compositionId
    ) return layer;
    return {
      ...layer,
      common: {
        ...layer.common,
        transform: {
          ...layer.common.transform,
          position: scalePoint(layer.common.transform.position),
          transformOffset: scalePoint(
            layer.common.transform.transformOffset
          ),
          scale: scalePoint(layer.common.transform.scale),
        },
        animation: {
          ...layer.common.animation,
          positionKeyframes:
            layer.common.animation.positionKeyframes.map(
              (keyframe) => ({
                ...keyframe,
                value: scalePoint(keyframe.value),
              })
            ),
          scaleKeyframes:
            layer.common.animation.scaleKeyframes.map(
              (keyframe) => ({
                ...keyframe,
                value: scalePoint(keyframe.value),
              })
            ),
        },
      },
    } as LayerDocument;
  });
  return {
    ...plan,
    scalePercent,
    prepared: {
      ...plan.prepared,
      width: Math.max(1, Math.round(plan.prepared.width * ratio)),
      height: Math.max(1, Math.round(plan.prepared.height * ratio)),
      command: {
        ...plan.prepared.command,
        layers,
      },
    },
  };
}

function renameImportPreviewNode(
  plan: LayerDocumentPsdImportPreviewPlan,
  layerDocumentId: string,
  name: string
): LayerDocumentPsdImportPreviewPlan {
  const nextName = name.trim();
  if (!nextName) return plan;
  const target = plan.prepared.command.layers.find(
    (layer) => layer.layerDocumentId === layerDocumentId
  );
  if (!target || target.name === nextName) return plan;
  const sourceId = target.common.source?.sourceId;
  return {
    ...plan,
    prepared: {
      ...plan.prepared,
      command: {
        ...plan.prepared.command,
        layers: plan.prepared.command.layers.map((layer) =>
          layer.layerDocumentId === layerDocumentId
            ? { ...layer, name: nextName } as LayerDocument
            : layer
        ),
        sources: plan.prepared.command.sources.map((source) =>
          source.sourceId === sourceId
            ? { ...source, displayName: nextName }
            : source
        ),
      },
    },
  };
}

function descendantIds(
  nodes: readonly LayerDocumentPsdImportPreviewNode[],
  layerDocumentId: string
) {
  const descendants = new Set<string>();
  const visit = (parentId: string) => {
    nodes.forEach((node) => {
      if (
        node.parentLayerDocumentId === parentId &&
        !descendants.has(node.layerDocumentId)
      ) {
        descendants.add(node.layerDocumentId);
        visit(node.layerDocumentId);
      }
    });
  };
  visit(layerDocumentId);
  return descendants;
}

function removeImportPreviewNode(
  plan: LayerDocumentPsdImportPreviewPlan,
  layerDocumentId: string
): LayerDocumentPsdImportPreviewPlan {
  if (
    layerDocumentId ===
    plan.prepared.command.selectLayerDocumentId
  ) {
    return plan;
  }
  const removedIds = descendantIds(plan.nodes, layerDocumentId);
  removedIds.add(layerDocumentId);
  if (!plan.nodes.some((node) => removedIds.has(node.layerDocumentId))) {
    return plan;
  }
  return {
    ...plan,
    nodes: plan.nodes.filter(
      (node) => !removedIds.has(node.layerDocumentId)
    ),
  };
}

function moveImportPreviewNode(
  plan: LayerDocumentPsdImportPreviewPlan,
  options: {
    layerDocumentId: string;
    parentLayerDocumentId: string | null;
    toIndex: number;
  }
): LayerDocumentPsdImportPreviewPlan {
  const target = plan.nodes.find(
    (node) => node.layerDocumentId === options.layerDocumentId
  );
  if (!target || !Number.isInteger(options.toIndex)) return plan;
  if (
    options.parentLayerDocumentId === options.layerDocumentId ||
    descendantIds(plan.nodes, options.layerDocumentId).has(
      options.parentLayerDocumentId ?? ""
    )
  ) return plan;
  const allowedParent =
    options.parentLayerDocumentId === target.parentLayerDocumentId ||
    plan.nodes.some(
      (node) =>
        node.layerDocumentId === options.parentLayerDocumentId &&
        node.canContainChildren
    );
  if (!allowedParent) return plan;
  const destination = plan.nodes
    .filter((node) =>
      node.layerDocumentId !== options.layerDocumentId &&
      node.parentLayerDocumentId === options.parentLayerDocumentId
    )
    .sort((left, right) => left.order - right.order);
  if (options.toIndex < 0 || options.toIndex > destination.length) {
    return plan;
  }
  destination.splice(options.toIndex, 0, {
    ...target,
    parentLayerDocumentId: options.parentLayerDocumentId,
  });
  const destinationOrder = new Map(
    destination.map((node, order) => [node.layerDocumentId, order])
  );
  let nodes = plan.nodes.map((node) => {
    if (node.layerDocumentId === options.layerDocumentId) {
      return {
        ...node,
        parentLayerDocumentId: options.parentLayerDocumentId,
        order: destinationOrder.get(node.layerDocumentId) ?? node.order,
      };
    }
    const order = destinationOrder.get(node.layerDocumentId);
    return order === undefined ? node : { ...node, order };
  });
  nodes = normalizeSiblingOrders(nodes, target.parentLayerDocumentId);
  return { ...plan, nodes };
}

function materializeImportPreviewPlan(
  plan: LayerDocumentPsdImportPreviewPlan
): PreparedLayerDocumentPsdImport {
  const placementById = new Map(
    plan.nodes.map((node) => [node.layerDocumentId, node])
  );
  const layers: LayerDocument[] = plan.prepared.command.layers.flatMap((layer) => {
    const placement = placementById.get(layer.layerDocumentId);
    return placement
      ? [{
          ...layer,
          common: {
            ...layer.common,
            placement: {
              ...layer.common.placement,
              parentLayerDocumentId: placement.parentLayerDocumentId,
              order: placement.order,
            },
          },
        } as LayerDocument]
      : [];
  });
  const retainedSourceIds = new Set(
    layers.flatMap((layer) =>
      layer.common.source?.sourceId
        ? [layer.common.source.sourceId]
        : []
    )
  );
  return {
    ...plan.prepared,
    command: {
      ...plan.prepared.command,
      layers,
      sources: plan.prepared.command.sources.filter((source) =>
        retainedSourceIds.has(source.sourceId)
      ),
    },
  };
}

function sourceChanged(
  current: SourceRegistryRecord,
  next: SourceRegistryRecord
) {
  return (
    layerDocumentSourceVisualFingerprint(current) !==
      layerDocumentSourceVisualFingerprint(next) ||
    current.version !== next.version ||
    current.displayName !== next.displayName ||
    layerDocumentSourceDescriptorPath(current) !==
      layerDocumentSourceDescriptorPath(next)
  );
}

function buildRefreshSummary(
  project: LayerDocumentProject,
  prepared: PreparedLayerDocumentPsdRefresh
): LayerDocumentPsdRefreshDiffSummary {
  const currentSources = project.payload.sourceRegistry.sourcesById;
  const documentSource = prepared.command.documentSource;
  const currentDocument = currentSources[documentSource.sourceId];
  const updatedSourceIds = currentDocument &&
    sourceChanged(currentDocument, documentSource)
    ? [documentSource.sourceId]
    : [];
  const newSourceIds: string[] = [];
  prepared.command.nodeSources.forEach((source) => {
    if (source.refresh.status === "deletePending") return;
    const current = currentSources[source.sourceId];
    if (!current) newSourceIds.push(source.sourceId);
    else if (sourceChanged(current, source)) {
      updatedSourceIds.push(source.sourceId);
    }
  });
  const nextNodeIds = new Set(
    prepared.command.nodeSources.flatMap((source) =>
      source.refresh.status === "deletePending"
        ? []
        : [source.sourceId]
    )
  );
  const deletePendingSourceIds = prepared.command.nodeSources
    .filter((source) =>
      source.refresh.status === "deletePending" &&
      !nextNodeIds.has(source.sourceId)
    )
    .map((source) => source.sourceId)
    .sort();
  return {
    documentSourceId: documentSource.sourceId,
    updatedSourceIds: updatedSourceIds.sort(),
    newSourceIds: newSourceIds.sort(),
    deletePendingSourceIds,
  };
}

/**
 * Source catalog/lifecycle controller only. It owns neither Layer edits nor
 * confirmed Source ordering. Confirmed Source tree order remains the
 * canonical name/id read-model order because the registry has no order field.
 */
export function createLayerDocumentPsdTreeController(options: {
  port: LayerDocumentPsdTreeCommandPort;
}) {
  return {
    read: options.port.readTree,
    readProject: options.port.readProject,
    selectSource: (sourceId: string | null) =>
      options.port.selectSource(
        sourceId
          ? { kind: "psd-tree-source", sourceId }
          : null
      ),
    toggleSourceVisibility:
      options.port.toggleSourceVisibility,
    toggleSourceLock: options.port.toggleSourceLock,
    renameSourceLayer: options.port.renameSourceLayer,
    deleteSourceLayer: options.port.deleteSourceLayer,
    openProject: options.port.openProject,
    readActiveGroupLayerDocumentId:
      options.port.readActiveGroupLayerDocumentId,
    prepareImport: async (
      input: Parameters<typeof prepareLayerDocumentPsdImport>[0]
    ) => createImportPreviewPlan(
      await prepareLayerDocumentPsdImport(input)
    ),
    moveImportPreviewNode,
    scaleImportPreview: scaleImportPreviewPlan,
    renameImportPreviewNode,
    removeImportPreviewNode,
    reorderImportPreviewNode: (
      plan: LayerDocumentPsdImportPreviewPlan,
      options: {
        parentLayerDocumentId: string | null;
        fromIndex: number;
        toIndex: number;
      }
    ) => {
      const siblings = plan.nodes
        .filter((node) =>
          node.parentLayerDocumentId === options.parentLayerDocumentId
        )
        .sort((left, right) => left.order - right.order);
      const target = siblings[options.fromIndex];
      return target
        ? moveImportPreviewNode(plan, {
            layerDocumentId: target.layerDocumentId,
            parentLayerDocumentId: options.parentLayerDocumentId,
            toIndex: options.toIndex,
          })
        : plan;
    },
    confirmImport: (plan: LayerDocumentPsdImportPreviewPlan) =>
      options.port.confirmImport(
        materializeImportPreviewPlan(plan)
      ),
    cancelImport: (plan: LayerDocumentPsdImportPreviewPlan) =>
      options.port.cancelImport(plan.prepared),
    prepareRefresh: async (
      input: Parameters<typeof prepareLayerDocumentPsdRefresh>[0]
    ): Promise<PreparedLayerDocumentPsdRefreshPlan> => {
      const prepared = await prepareLayerDocumentPsdRefresh(input);
      return {
        prepared,
        summary: buildRefreshSummary(
          options.port.readProject(),
          prepared
        ),
      };
    },
    confirmRefresh: (
      plan: PreparedLayerDocumentPsdRefreshPlan,
      cacheContext: SourceRegistryCacheInvalidationContext
    ) => options.port.confirmRefresh(plan.prepared, cacheContext),
    cancelRefresh: (plan: PreparedLayerDocumentPsdRefreshPlan) =>
      options.port.cancelRefresh(plan.prepared),
    refreshSource: options.port.refreshSource,
    reconnect: options.port.reconnect,
    deleteSource: options.port.deleteSource,
    sourceForRefresh: (sourceId: string): PsdDocumentSourceRecord | null => {
      const source = options.port.readProject()
        .payload.sourceRegistry.sourcesById[sourceId];
      return source?.kind === "psd-document" ? source : null;
    },
  };
}

export type LayerDocumentPsdTreeController = ReturnType<
  typeof createLayerDocumentPsdTreeController
>;
