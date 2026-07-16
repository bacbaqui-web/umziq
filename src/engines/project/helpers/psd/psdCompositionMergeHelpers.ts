import { flattenRenderDrawables } from "@/engines/project/import/psdImportHelpers";
import type { ParsedPsdDocument } from "@/engines/project/import/psdLoader";
import { removeCompDataFromRecord } from "@/engines/project/helpers/projectModelHelpers";
import type { Composition, CompositionMeta, Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";
import {
  type ProjectDataState,
  type PsdCompositionMergeResult as MergeNodeResult,
  type PsdDirectSourceDescriptor as DirectSourceDescriptor,
  type PsdRefreshCounts as RefreshCounts,
} from "@/engines/project/models/psdRefreshResultModel";
import {
  countSourceEntitiesInComposition,
  getSourceStatusAfterMissing,
  getSourceStatusAfterRefresh,
  markCompositionSubtreeStatus,
  INITIAL_PSD_REFRESH_COUNTS as INITIAL_REFRESH_COUNTS,
  mergePsdRefreshCounts as mergeCounts,
} from "@/engines/project/helpers/psd/psdSourceStatusHelpers";
import {
  buildChildPathById,
  buildLayerPathById,
  buildMergedEntityOrder,
  collectCompositionIds,
} from "@/engines/project/helpers/psd/psdSourceMatchingHelpers";
import {
  buildTimelineTemplateMap,
  patchNewTimelineItemSource,
  updateDirectTimelineItem,
} from "@/engines/project/helpers/psd/psdTimelineMergeHelpers";
import {
  buildRenderTemplateMap,
  clonePsdDrawables as cloneDrawables,
  patchNewRenderItemSource,
  updateDirectRenderItem,
} from "@/engines/project/helpers/psd/psdRenderMergeHelpers";

function mergeCompositionNode(
  existingComp: Composition,
  refreshedComp: Composition,
  currentState: ProjectDataState
): MergeNodeResult {
  const existingChildren = existingComp.children ?? [];
  const refreshedChildren = refreshedComp.children ?? [];
  const existingChildrenByPath = new Map(
    existingChildren
      .filter((child): child is Composition & { sourcePath: string } => !!child.sourcePath)
      .map((child) => [child.sourcePath, child])
  );
  const refreshedChildrenByPath = new Map(
    refreshedChildren
      .filter((child): child is Composition & { sourcePath: string } => !!child.sourcePath)
      .map((child) => [child.sourcePath, child])
  );
  const existingLayersByPath = new Map(
    existingComp.layers
      .filter((layer): layer is Layer & { sourcePath: string } => !!layer.sourcePath)
      .map((layer) => [layer.sourcePath, layer])
  );
  const refreshedLayersByPath = new Map(
    refreshedComp.layers
      .filter((layer): layer is Layer & { sourcePath: string } => !!layer.sourcePath)
      .map((layer) => [layer.sourcePath, layer])
  );

  const childResultsByPath = new Map<string, MergeNodeResult>();
  const childCounts: RefreshCounts[] = [];

  existingChildren.forEach((existingChild) => {
    if (!existingChild.sourcePath) {
      const fallbackResult: MergeNodeResult = {
        ...currentState,
        composition: existingChild,
        counts: INITIAL_REFRESH_COUNTS,
      };
      childResultsByPath.set(existingChild.id, fallbackResult);
      return;
    }

    const refreshedChild = refreshedChildrenByPath.get(existingChild.sourcePath);

    if (!refreshedChild) {
      const nextStatus = getSourceStatusAfterMissing(existingChild.sourceSyncStatus);
      const keptChild: Composition = {
        ...existingChild,
        sourceSyncStatus: nextStatus,
      };
      const keptChildCompIds = collectCompositionIds(existingChild);
      const keptMeta = Object.fromEntries(
        keptChildCompIds
          .filter((compId) => currentState.metaByCompId[compId])
          .map((compId) => [compId, currentState.metaByCompId[compId]])
      );
      const keptTimeline = Object.fromEntries(
        keptChildCompIds.map((compId) => [compId, currentState.timelineItemsByCompId[compId] ?? []])
      );
      const keptRender = Object.fromEntries(
        keptChildCompIds.map((compId) => [compId, currentState.renderItemsByCompId[compId] ?? []])
      );
      const counts = {
        ...INITIAL_REFRESH_COUNTS,
        deletePending: nextStatus === "deletePending" ? 1 : 0,
      };

      childResultsByPath.set(existingChild.sourcePath, {
        comps: [keptChild],
        metaByCompId: keptMeta,
        timelineItemsByCompId: keptTimeline,
        renderItemsByCompId: keptRender,
        composition: keptChild,
        counts,
      });
      childCounts.push(counts);
      return;
    }

    const mergedChild = mergeCompositionNode(existingChild, refreshedChild, currentState);
    childResultsByPath.set(existingChild.sourcePath, mergedChild);
    childCounts.push(mergedChild.counts);
  });

  const newChildren = refreshedChildren.filter(
    (child) => !!child.sourcePath && !existingChildrenByPath.has(child.sourcePath)
  );

  newChildren.forEach((child) => {
    if (!child.sourcePath) {
      return;
    }

    const nextChild = markCompositionSubtreeStatus(child, "new");
    const childCompIds = collectCompositionIds(child);
    const childMeta = Object.fromEntries(
      childCompIds
        .filter((compId) => currentState.metaByCompId[compId])
        .map((compId) => [compId, currentState.metaByCompId[compId]])
    );
    const childTimeline = Object.fromEntries(
      childCompIds.map((compId) => [compId, currentState.timelineItemsByCompId[compId] ?? []])
    );
    const childRender = Object.fromEntries(
      childCompIds.map((compId) => [compId, currentState.renderItemsByCompId[compId] ?? []])
    );
    const counts = {
      ...INITIAL_REFRESH_COUNTS,
      added: countSourceEntitiesInComposition(nextChild),
    };

    childResultsByPath.set(child.sourcePath, {
      comps: [nextChild],
      metaByCompId: childMeta,
      timelineItemsByCompId: childTimeline,
      renderItemsByCompId: childRender,
      composition: nextChild,
      counts,
    });
    childCounts.push(counts);
  });

  const mergedChildren = buildMergedEntityOrder(existingChildren, refreshedChildren)
    .map((child) => {
      if (child.sourcePath) {
        return childResultsByPath.get(child.sourcePath)?.composition ?? child;
      }

      return childResultsByPath.get(child.id)?.composition ?? child;
    })
    .filter((child): child is Composition => !!child);

  const layerCounts: RefreshCounts[] = [];
  const mergedLayers: Layer[] = buildMergedEntityOrder(
    existingComp.layers,
    refreshedComp.layers
  ).map<Layer>((candidateLayer) => {
      const sourcePath = candidateLayer.sourcePath;

      if (!sourcePath) {
        return candidateLayer;
      }

      const existingLayer = existingLayersByPath.get(sourcePath);
      const refreshedLayer = refreshedLayersByPath.get(sourcePath);

      if (existingLayer && refreshedLayer) {
        const nextStatus = getSourceStatusAfterRefresh(
          existingLayer.sourceSyncStatus,
          existingLayer.sourceFingerprint !== refreshedLayer.sourceFingerprint
        );

        layerCounts.push({
          ...INITIAL_REFRESH_COUNTS,
          updated: nextStatus === "updated" ? 1 : 0,
        });

        return {
          ...existingLayer,
          name: refreshedLayer.name,
          visible: refreshedLayer.visible,
          sourcePath: refreshedLayer.sourcePath,
          sourceFingerprint: refreshedLayer.sourceFingerprint,
          sourceSyncStatus: nextStatus,
        };
      }

      if (!existingLayer && refreshedLayer) {
        layerCounts.push({
          ...INITIAL_REFRESH_COUNTS,
          added: 1,
        });

        return {
          ...refreshedLayer,
          sourceSyncStatus: "new",
        };
      }

      if (existingLayer) {
        const nextStatus = getSourceStatusAfterMissing(existingLayer.sourceSyncStatus);

        layerCounts.push({
          ...INITIAL_REFRESH_COUNTS,
          deletePending: nextStatus === "deletePending" ? 1 : 0,
        });

        return {
          ...existingLayer,
          sourceSyncStatus: nextStatus,
        };
      }

      return candidateLayer;
    });

  const refreshedMeta = currentState.metaByCompId[refreshedComp.id];
  const existingMeta = currentState.metaByCompId[existingComp.id];
  const compStatus = getSourceStatusAfterRefresh(
    existingComp.sourceSyncStatus,
    existingComp.sourceFingerprint !== refreshedComp.sourceFingerprint
  );
  const mergedComp: Composition = {
    ...existingComp,
    name: refreshedComp.name,
    sourcePath: refreshedComp.sourcePath,
    sourceFingerprint: refreshedComp.sourceFingerprint,
    sourceSyncStatus: compStatus,
    children: mergedChildren,
    layers: mergedLayers,
  };

  const refreshedTimelineItems = currentState.timelineItemsByCompId[refreshedComp.id] ?? [];
  const refreshedRenderItems = currentState.renderItemsByCompId[refreshedComp.id] ?? [];
  const existingTimelineItems = currentState.timelineItemsByCompId[existingComp.id] ?? [];
  const existingRenderItems = currentState.renderItemsByCompId[existingComp.id] ?? [];
  const existingLayerPathsById = buildLayerPathById(existingComp.layers);
  const existingChildPathsById = buildChildPathById(existingChildren);
  const refreshedTimelineTemplates = buildTimelineTemplateMap(
    refreshedTimelineItems,
    refreshedComp.layers,
    refreshedChildren
  );
  const refreshedRenderTemplates = buildRenderTemplateMap(
    refreshedRenderItems,
    refreshedComp.layers,
    refreshedChildren
  );
  const childResultByPath = new Map(
    mergedChildren
      .filter((child): child is Composition & { sourcePath: string } => !!child.sourcePath)
      .map((child) => [child.sourcePath, childResultsByPath.get(child.sourcePath)!])
  );
  const descriptorByKey = new Map<string, DirectSourceDescriptor>();

  mergedLayers.forEach((layer) => {
    if (!layer.sourcePath) {
      return;
    }

    const key = `layer:${layer.sourcePath}`;
    const refreshedTimelineItem = refreshedTimelineTemplates.get(key);
    const refreshedRenderItem = refreshedRenderTemplates.get(key);
    const existingLayer = existingLayersByPath.get(layer.sourcePath);
    const nextDrawables = refreshedRenderItem
      ? cloneDrawables(refreshedRenderItem.drawables, layer.id)
      : null;

    descriptorByKey.set(key, {
      kind: "layer",
      sourcePath: layer.sourcePath,
      entity: layer,
      sourceStatus: layer.sourceSyncStatus ?? "normal",
      isNewSource: !existingLayer && !!refreshedLayersByPath.get(layer.sourcePath),
      isMissingSource: !!existingLayer && !refreshedLayersByPath.get(layer.sourcePath),
      nextName: refreshedTimelineItem?.name ?? layer.name,
      nextVisible: refreshedTimelineItem?.visible ?? layer.visible,
      nextDrawables,
      newTimelineItemTemplate: refreshedTimelineItem
        ? patchNewTimelineItemSource(refreshedTimelineItem, layer)
        : null,
      newRenderItemTemplate:
        refreshedRenderItem && nextDrawables
          ? patchNewRenderItemSource(refreshedRenderItem, layer, nextDrawables)
          : null,
    });
  });

  mergedChildren.forEach((child) => {
    if (!child.sourcePath) {
      return;
    }

    const key = `subComp:${child.sourcePath}`;
    const refreshedTimelineItem = refreshedTimelineTemplates.get(key);
    const refreshedRenderItem = refreshedRenderTemplates.get(key);
    const existingChild = existingChildrenByPath.get(child.sourcePath);
    const childRenderItems =
      childResultByPath.get(child.sourcePath)?.renderItemsByCompId[child.id] ?? [];
    const nextDrawables = cloneDrawables(flattenRenderDrawables(childRenderItems));

    descriptorByKey.set(key, {
      kind: "subComp",
      sourcePath: child.sourcePath,
      entity: child,
      sourceStatus: child.sourceSyncStatus ?? "normal",
      isNewSource: !existingChild && !!refreshedChildrenByPath.get(child.sourcePath),
      isMissingSource: !!existingChild && !refreshedChildrenByPath.get(child.sourcePath),
      nextName: refreshedTimelineItem?.name ?? child.name,
      nextVisible: refreshedTimelineItem?.visible ?? true,
      nextDrawables,
      newTimelineItemTemplate: refreshedTimelineItem
        ? patchNewTimelineItemSource(refreshedTimelineItem, child)
        : null,
      newRenderItemTemplate:
        refreshedRenderItem
          ? patchNewRenderItemSource(refreshedRenderItem, child, nextDrawables)
          : null,
    });
  });

  const mergedTimelineItems = [
    ...existingTimelineItems.map((item) => {
      const sourcePath =
        item.kind === "layer"
          ? existingLayerPathsById.get(item.sourceId)
          : existingChildPathsById.get(item.sourceId);

      if (!sourcePath) {
        return item;
      }

      const descriptor = descriptorByKey.get(`${item.kind}:${sourcePath}`);

      return descriptor ? updateDirectTimelineItem(item, descriptor) : item;
    }),
    ...Array.from(descriptorByKey.values())
      .filter((descriptor) => descriptor.isNewSource && descriptor.newTimelineItemTemplate)
      .map((descriptor) => descriptor.newTimelineItemTemplate as TimelineItem),
  ];

  const mergedRenderItems = [
    ...existingRenderItems.map((item) => {
      const sourcePath =
        item.kind === "layer"
          ? existingLayerPathsById.get(item.sourceId)
          : existingChildPathsById.get(item.sourceId);

      if (!sourcePath) {
        return item;
      }

      const descriptor = descriptorByKey.get(`${item.kind}:${sourcePath}`);

      return descriptor ? updateDirectRenderItem(item, descriptor) : item;
    }),
    ...Array.from(descriptorByKey.values())
      .filter((descriptor) => descriptor.isNewSource && descriptor.newRenderItemTemplate)
      .map((descriptor) => descriptor.newRenderItemTemplate as RenderItem),
  ];

  const mergedMeta: CompositionMeta = existingMeta
    ? {
        ...existingMeta,
        width: refreshedMeta?.width ?? existingMeta.width,
        height: refreshedMeta?.height ?? existingMeta.height,
        layerCount: refreshedMeta?.layerCount ?? existingMeta.layerCount,
        sourceFileName: refreshedMeta?.sourceFileName ?? existingMeta.sourceFileName,
      }
    : refreshedMeta;

  const childMetaEntries = Object.assign(
    {},
    ...mergedChildren.map(
      (child) =>
        (child.sourcePath
          ? childResultByPath.get(child.sourcePath)
          : childResultsByPath.get(child.id))?.metaByCompId ?? {}
    )
  );
  const childTimelineEntries = Object.assign(
    {},
    ...mergedChildren.map(
      (child) =>
        (child.sourcePath
          ? childResultByPath.get(child.sourcePath)
          : childResultsByPath.get(child.id))?.timelineItemsByCompId ?? {}
    )
  );
  const childRenderEntries = Object.assign(
    {},
    ...mergedChildren.map(
      (child) =>
        (child.sourcePath
          ? childResultByPath.get(child.sourcePath)
          : childResultsByPath.get(child.id))?.renderItemsByCompId ?? {}
    )
  );

  return {
    comps: [mergedComp],
    metaByCompId: {
      ...childMetaEntries,
      ...(mergedMeta ? { [existingComp.id]: mergedMeta } : {}),
    },
    timelineItemsByCompId: {
      ...childTimelineEntries,
      [existingComp.id]: mergedTimelineItems,
    },
    renderItemsByCompId: {
      ...childRenderEntries,
      [existingComp.id]: mergedRenderItems,
    },
    composition: mergedComp,
    counts: mergeCounts(
      ...childCounts,
      ...layerCounts,
      {
        ...INITIAL_REFRESH_COUNTS,
        updated: compStatus === "updated" ? 1 : 0,
      }
    ),
  };
}

export function mergeRefreshedMainCompIntoProject(
  currentState: ProjectDataState,
  existingMainComp: Composition,
  refreshedDocument: ParsedPsdDocument
) {
  const mergedMainComp = mergeCompositionNode(
    existingMainComp,
    refreshedDocument.composition,
    {
      comps: [refreshedDocument.composition],
      metaByCompId: {
        ...currentState.metaByCompId,
        ...refreshedDocument.metaByCompId,
      },
      timelineItemsByCompId: {
        ...currentState.timelineItemsByCompId,
        ...refreshedDocument.timelineItemsByCompId,
      },
      renderItemsByCompId: {
        ...currentState.renderItemsByCompId,
        ...refreshedDocument.renderItemsByCompId,
      },
    }
  );

  return {
    comps: currentState.comps.map((comp) =>
      comp.id === existingMainComp.id ? mergedMainComp.composition : comp
    ),
    metaByCompId: {
      ...removeCompDataFromRecord(currentState.metaByCompId, existingMainComp),
      ...mergedMainComp.metaByCompId,
    },
    timelineItemsByCompId: {
      ...removeCompDataFromRecord(currentState.timelineItemsByCompId, existingMainComp),
      ...mergedMainComp.timelineItemsByCompId,
    },
    renderItemsByCompId: {
      ...removeCompDataFromRecord(currentState.renderItemsByCompId, existingMainComp),
      ...mergedMainComp.renderItemsByCompId,
    },
    counts: mergedMainComp.counts,
  };
}
