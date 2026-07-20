import type { Composition, SourceSyncStatus, TimelineItem, TimelineItemKind } from "@/models";
import { findCompositionById, removeCompDataFromRecord } from "@/engines/project/helpers/projectModelHelpers";
import type { ProjectDataState } from "@/engines/project/models/psdRefreshResultModel";

function updateCompositionTree(
  comps: Composition[],
  targetCompId: string,
  updater: (comp: Composition) => Composition
): Composition[] {
  return comps.map((comp) => {
    if (comp.id === targetCompId) return updater(comp);
    if (!comp.children || comp.children.length === 0) return comp;
    return {
      ...comp,
      children: updateCompositionTree(comp.children, targetCompId, updater),
    };
  });
}

function updateSourceStatusInComposition(
  composition: Composition,
  kind: TimelineItemKind,
  sourceId: string,
  nextStatus: SourceSyncStatus
): Composition {
  if (kind === "subComp" && composition.id === sourceId) {
    return { ...composition, sourceSyncStatus: nextStatus };
  }

  return {
    ...composition,
    layers: composition.layers.map((layer) =>
      kind === "layer" && layer.id === sourceId
        ? { ...layer, sourceSyncStatus: nextStatus }
        : layer
    ),
    children: composition.children?.map((child) =>
      updateSourceStatusInComposition(child, kind, sourceId, nextStatus)
    ),
  };
}

export function acknowledgeTimelineSourceStatus(
  comps: Composition[],
  item: TimelineItem
) {
  return comps.map((comp) =>
    updateSourceStatusInComposition(comp, item.kind, item.sourceId, "normal")
  );
}

export function acknowledgeCompositionSourceStatus(
  comps: Composition[],
  targetCompId: string
): Composition[] {
  let changed = false;

  const visit = (composition: Composition): Composition => {
    if (composition.id === targetCompId && composition.sourceSyncStatus === "new") {
      changed = true;
      return { ...composition, sourceSyncStatus: "normal" };
    }

    const children = composition.children?.map(visit);
    if (children?.some((child, index) => child !== composition.children?.[index])) {
      return { ...composition, children };
    }
    return composition;
  };

  const nextComps = comps.map(visit);
  return changed ? nextComps : comps;
}

export function markTimelineSourceMissing(
  comps: Composition[],
  item: TimelineItem
) {
  return comps.map((comp) =>
    updateSourceStatusInComposition(comp, item.kind, item.sourceId, "missing")
  );
}

export function deleteTimelineSourceFromProject(
  currentState: ProjectDataState,
  item: TimelineItem
): ProjectDataState {
  const ownerComp = findCompositionById(currentState.comps, item.compId);
  if (!ownerComp) return currentState;

  if (item.kind === "layer") {
    return {
      comps: updateCompositionTree(currentState.comps, item.compId, (comp) => ({
        ...comp,
        layers: comp.layers.filter((layer) => layer.id !== item.sourceId),
      })),
      metaByCompId: currentState.metaByCompId,
      timelineItemsByCompId: {
        ...currentState.timelineItemsByCompId,
        [item.compId]: (currentState.timelineItemsByCompId[item.compId] ?? []).filter(
          (timelineItem) =>
            !(timelineItem.kind === "layer" && timelineItem.sourceId === item.sourceId)
        ),
      },
      renderItemsByCompId: {
        ...currentState.renderItemsByCompId,
        [item.compId]: (currentState.renderItemsByCompId[item.compId] ?? []).filter(
          (renderItem) =>
            !(renderItem.kind === "layer" && renderItem.sourceId === item.sourceId)
        ),
      },
    };
  }

  const childComp = ownerComp.children?.find((child) => child.id === item.sourceId);
  if (!childComp) return currentState;

  return {
    comps: updateCompositionTree(currentState.comps, item.compId, (comp) => ({
      ...comp,
      children: comp.children?.filter((child) => child.id !== item.sourceId) ?? [],
    })),
    metaByCompId: removeCompDataFromRecord(currentState.metaByCompId, childComp),
    timelineItemsByCompId: {
      ...removeCompDataFromRecord(currentState.timelineItemsByCompId, childComp),
      [item.compId]: (currentState.timelineItemsByCompId[item.compId] ?? []).filter(
        (timelineItem) =>
          !(timelineItem.kind === "subComp" && timelineItem.sourceId === item.sourceId)
      ),
    },
    renderItemsByCompId: {
      ...removeCompDataFromRecord(currentState.renderItemsByCompId, childComp),
      [item.compId]: (currentState.renderItemsByCompId[item.compId] ?? []).filter(
        (renderItem) =>
          !(renderItem.kind === "subComp" && renderItem.sourceId === item.sourceId)
      ),
    },
  };
}
