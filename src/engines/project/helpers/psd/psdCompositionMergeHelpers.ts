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
  countNewSourcesInComposition,
  getSourceStatusAfterMissing,
  getSourceStatusAfterRefresh,
  markCompositionSubtreeStatus,
  INITIAL_PSD_REFRESH_COUNTS as INITIAL_REFRESH_COUNTS,
  mergePsdRefreshCounts as mergeCounts,
} from "@/engines/project/helpers/psd/psdSourceStatusHelpers";
import {
  buildPsdRefreshSourceMatches,
  collectCompositionIds,
  type PsdRefreshSourceMatches,
} from "@/engines/project/helpers/psd/psdSourceMatchingHelpers";
import {
  patchNewTimelineItemSource,
  updateDirectTimelineItem,
} from "@/engines/project/helpers/psd/psdTimelineMergeHelpers";
import {
  clonePsdDrawables as cloneDrawables,
  patchNewRenderItemSource,
  updateDirectRenderItem,
} from "@/engines/project/helpers/psd/psdRenderMergeHelpers";

type PsdRefreshMergeContext = PsdRefreshSourceMatches & {
  refreshedTimelineBySourceId: Map<string, TimelineItem>;
  refreshedRenderBySourceId: Map<string, RenderItem>;
};

function buildRefreshedSourceTemplateMaps(
  composition: Composition,
  currentState: ProjectDataState,
  timelineBySourceId = new Map<string, TimelineItem>(),
  renderBySourceId = new Map<string, RenderItem>()
) {
  (currentState.timelineItemsByCompId[composition.id] ?? []).forEach((item) => {
    if (!timelineBySourceId.has(item.sourceId)) timelineBySourceId.set(item.sourceId, item);
  });
  (currentState.renderItemsByCompId[composition.id] ?? []).forEach((item) => {
    if (!renderBySourceId.has(item.sourceId)) renderBySourceId.set(item.sourceId, item);
  });
  (composition.children ?? []).forEach((child) =>
    buildRefreshedSourceTemplateMaps(child, currentState, timelineBySourceId, renderBySourceId)
  );
  return { timelineBySourceId, renderBySourceId };
}

function mergeCompositionNode(
  existingComp: Composition,
  refreshedComp: Composition,
  currentState: ProjectDataState,
  context: PsdRefreshMergeContext
): MergeNodeResult {
  const existingChildren = existingComp.children ?? [];
  const refreshedChildren = refreshedComp.children ?? [];
  const childResultsById = new Map<string, MergeNodeResult>();
  const childCounts: RefreshCounts[] = [];

  existingChildren.forEach((existingChild) => {
    if (!existingChild.sourcePath) {
      const fallbackResult: MergeNodeResult = {
        ...currentState,
        composition: existingChild,
        counts: INITIAL_REFRESH_COUNTS,
      };
      childResultsById.set(existingChild.id, fallbackResult);
      return;
    }

    const refreshedChild = context.refreshedChildByExistingId.get(existingChild.id);

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
        missing: nextStatus === "missing" ? 1 : 0,
      };

      childResultsById.set(existingChild.id, {
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

    const mergedChild = mergeCompositionNode(existingChild, refreshedChild, currentState, context);
    childResultsById.set(existingChild.id, mergedChild);
    childCounts.push(mergedChild.counts);
  });

  const newChildren = refreshedChildren.filter(
    (child) => !!child.sourcePath && !context.matchedRefreshedChildIds.has(child.id)
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
    const newSourceCounts = countNewSourcesInComposition(nextChild);
    const counts = {
      ...INITIAL_REFRESH_COUNTS,
      ...newSourceCounts,
    };

    childResultsById.set(child.id, {
      comps: [nextChild],
      metaByCompId: childMeta,
      timelineItemsByCompId: childTimeline,
      renderItemsByCompId: childRender,
      composition: nextChild,
      counts,
    });
    childCounts.push(counts);
  });

  const mergedChildren = [...newChildren, ...existingChildren]
    .map((child) => childResultsById.get(child.id)?.composition ?? child)
    .filter((child): child is Composition => !!child);

  const layerCounts: RefreshCounts[] = [];
  const existingLayersById = new Map(existingComp.layers.map((layer) => [layer.id, layer]));
  const newLayers = refreshedComp.layers.filter(
    (layer) => !!layer.sourcePath && !context.matchedRefreshedLayerIds.has(layer.id)
  );
  const mergedLayers: Layer[] = [...newLayers, ...existingComp.layers].map<Layer>(
    (candidateLayer) => {
      const existingLayer = existingLayersById.get(candidateLayer.id);
      const refreshedLayer = existingLayer
        ? context.refreshedLayerByExistingId.get(existingLayer.id)
        : candidateLayer;

      if (existingLayer && refreshedLayer) {
        const sourceChanged =
          existingLayer.sourceFingerprint !== refreshedLayer.sourceFingerprint;
        const sourceReturned =
          existingLayer.sourceSyncStatus === "deletePending" ||
          existingLayer.sourceSyncStatus === "missing";
        const nextStatus = getSourceStatusAfterRefresh(
          existingLayer.sourceSyncStatus,
          sourceChanged
        );

        layerCounts.push({
          ...INITIAL_REFRESH_COUNTS,
          updated: sourceChanged || sourceReturned ? 1 : 0,
        });

        return {
          ...existingLayer,
          visible: refreshedLayer.visible,
          sourceIdentity: existingLayer.sourceIdentity ?? refreshedLayer.sourceIdentity,
          sourceFingerprint: refreshedLayer.sourceFingerprint,
          sourceSyncStatus: nextStatus,
        };
      }

      if (!existingLayer) {
        layerCounts.push({
          ...INITIAL_REFRESH_COUNTS,
          newLayers: 1,
        });

        return {
          ...candidateLayer,
          sourceSyncStatus: "new",
        };
      }

      const nextStatus = getSourceStatusAfterMissing(existingLayer.sourceSyncStatus);

      layerCounts.push({
        ...INITIAL_REFRESH_COUNTS,
        deletePending: nextStatus === "deletePending" ? 1 : 0,
        missing: nextStatus === "missing" ? 1 : 0,
      });

      return {
        ...existingLayer,
        sourceSyncStatus: nextStatus,
      };
    }
  );

  const refreshedMeta = currentState.metaByCompId[refreshedComp.id];
  const existingMeta = currentState.metaByCompId[existingComp.id];
  const compSourceChanged =
    existingComp.sourceFingerprint !== refreshedComp.sourceFingerprint;
  const compSourceReturned =
    existingComp.sourceSyncStatus === "deletePending" ||
    existingComp.sourceSyncStatus === "missing";
  const compStatus = getSourceStatusAfterRefresh(
    existingComp.sourceSyncStatus,
    compSourceChanged
  );
  const mergedComp: Composition = {
    ...existingComp,
    sourceIdentity: existingComp.sourceIdentity ?? refreshedComp.sourceIdentity,
    importSettings: existingComp.importSettings ?? refreshedComp.importSettings,
    sourceFingerprint: refreshedComp.sourceFingerprint,
    sourceSyncStatus: compStatus,
    children: mergedChildren,
    layers: mergedLayers,
  };

  const existingTimelineItems = currentState.timelineItemsByCompId[existingComp.id] ?? [];
  const existingRenderItems = currentState.renderItemsByCompId[existingComp.id] ?? [];
  const descriptorByKey = new Map<string, DirectSourceDescriptor>();

  mergedLayers.forEach((layer) => {
    if (!layer.sourcePath) {
      return;
    }

    const key = `layer:${layer.id}`;
    const existingLayer = existingLayersById.get(layer.id);
    const refreshedLayer = existingLayer
      ? context.refreshedLayerByExistingId.get(existingLayer.id)
      : layer;
    const refreshedTimelineItem = refreshedLayer
      ? context.refreshedTimelineBySourceId.get(refreshedLayer.id)
      : undefined;
    const refreshedRenderItem = refreshedLayer
      ? context.refreshedRenderBySourceId.get(refreshedLayer.id)
      : undefined;
    const nextDrawables = refreshedRenderItem
      ? cloneDrawables(refreshedRenderItem.drawables, layer.id)
      : null;

    descriptorByKey.set(key, {
      kind: "layer",
      sourcePath: layer.sourcePath,
      entity: layer,
      sourceStatus: layer.sourceSyncStatus ?? "normal",
      isNewSource: !existingLayer,
      isMissingSource: !!existingLayer && !refreshedLayer,
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

    const key = `subComp:${child.id}`;
    const existingChild = existingChildren.find((candidate) => candidate.id === child.id);
    const refreshedChild = existingChild
      ? context.refreshedChildByExistingId.get(existingChild.id)
      : child;
    const refreshedTimelineItem = refreshedChild
      ? context.refreshedTimelineBySourceId.get(refreshedChild.id)
      : undefined;
    const refreshedRenderItem = refreshedChild
      ? context.refreshedRenderBySourceId.get(refreshedChild.id)
      : undefined;
    const childRenderItems =
      childResultsById.get(child.id)?.renderItemsByCompId[child.id] ?? [];
    const nextDrawables = cloneDrawables(flattenRenderDrawables(childRenderItems));

    descriptorByKey.set(key, {
      kind: "subComp",
      sourcePath: child.sourcePath,
      entity: child,
      sourceStatus: child.sourceSyncStatus ?? "normal",
      isNewSource: !existingChild,
      isMissingSource: !!existingChild && !refreshedChild,
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

  const refreshedTimelineOrder = new Map(
    (currentState.timelineItemsByCompId[refreshedComp.id] ?? []).map((item, index) => [
      item.sourceId,
      index,
    ])
  );
  const newTimelineItems = Array.from(descriptorByKey.values())
    .flatMap((descriptor) =>
      descriptor.isNewSource && descriptor.newTimelineItemTemplate
        ? [descriptor.newTimelineItemTemplate]
        : []
    )
    .sort(
      (a, b) =>
        (refreshedTimelineOrder.get(a.sourceId) ?? Number.MAX_SAFE_INTEGER) -
        (refreshedTimelineOrder.get(b.sourceId) ?? Number.MAX_SAFE_INTEGER)
    );
  const mergedTimelineItems = [
    ...newTimelineItems,
    ...existingTimelineItems.map((item) => {
      const descriptor = descriptorByKey.get(`${item.kind}:${item.sourceId}`);

      return descriptor ? updateDirectTimelineItem(item, descriptor) : item;
    }),
  ];

  const refreshedRenderOrder = new Map(
    (currentState.renderItemsByCompId[refreshedComp.id] ?? []).map((item, index) => [
      item.sourceId,
      index,
    ])
  );
  const newRenderItems = Array.from(descriptorByKey.values())
    .flatMap((descriptor) =>
      descriptor.isNewSource && descriptor.newRenderItemTemplate
        ? [descriptor.newRenderItemTemplate]
        : []
    )
    .sort(
      (a, b) =>
        (refreshedRenderOrder.get(a.sourceId) ?? Number.MAX_SAFE_INTEGER) -
        (refreshedRenderOrder.get(b.sourceId) ?? Number.MAX_SAFE_INTEGER)
    );
  const mergedRenderItems = [
    ...newRenderItems,
    ...existingRenderItems.map((item) => {
      const descriptor = descriptorByKey.get(`${item.kind}:${item.sourceId}`);

      return descriptor ? updateDirectRenderItem(item, descriptor) : item;
    }),
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
      (child) => childResultsById.get(child.id)?.metaByCompId ?? {}
    )
  );
  const childTimelineEntries = Object.assign(
    {},
    ...mergedChildren.map(
      (child) => childResultsById.get(child.id)?.timelineItemsByCompId ?? {}
    )
  );
  const childRenderEntries = Object.assign(
    {},
    ...mergedChildren.map(
      (child) => childResultsById.get(child.id)?.renderItemsByCompId ?? {}
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
        updated: compSourceChanged || compSourceReturned ? 1 : 0,
      }
    ),
  };
}

export function mergeRefreshedMainCompIntoProject(
  currentState: ProjectDataState,
  existingMainComp: Composition,
  refreshedDocument: ParsedPsdDocument
) {
  const refreshState = {
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
  };
  const templateMaps = buildRefreshedSourceTemplateMaps(
    refreshedDocument.composition,
    refreshState
  );
  const mergedMainComp = mergeCompositionNode(
    existingMainComp,
    refreshedDocument.composition,
    refreshState,
    {
      ...buildPsdRefreshSourceMatches(existingMainComp, refreshedDocument.composition),
      refreshedTimelineBySourceId: templateMaps.timelineBySourceId,
      refreshedRenderBySourceId: templateMaps.renderBySourceId,
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
