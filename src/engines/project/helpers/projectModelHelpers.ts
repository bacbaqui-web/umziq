import type {
  Composition,
  CompositionMeta,
  Layer,
  PropertyTrackState,
  TimelineItem,
} from "@/models";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";
import type { TimelineSelection } from "@/models";
import { DEFAULT_DURATION_FRAMES } from "@/engines/project/constants/projectConstants";

export function sortPsdFilesByName(files: File[]) {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

export function findMainComp(comps: Composition[], comp: Composition | null) {
  if (!comp) return null;
  if (comp.type === "main") return comp;
  return findMainComp(comps, findCompositionById(comps, comp.parentId ?? "") ?? null);
}

export function collectLayersById(comps: Composition[]) {
  const layerMap = new Map<string, Layer>();

  const visit = (comp: Composition) => {
    comp.layers.forEach((layer) => {
      layerMap.set(layer.id, layer);
    });
    comp.children?.forEach(visit);
  };

  comps.forEach(visit);
  return layerMap;
}

export function collectCompositionsById(comps: Composition[]) {
  const compMap = new Map<string, Composition>();

  const visit = (comp: Composition) => {
    compMap.set(comp.id, comp);
    comp.children?.forEach(visit);
  };

  comps.forEach(visit);
  return compMap;
}

export function resolveTimelineSelectionForComposition(
  compId: string,
  timelineItems: TimelineItem[],
  lastSelectedItemByCompId: Record<string, NonNullable<TimelineSelection>>
): TimelineSelection {
  const rememberedSelection = lastSelectedItemByCompId[compId];

  if (rememberedSelection) {
    const rememberedItemExists = timelineItems.some(
      (item) =>
        (rememberedSelection.itemId
          ? item.id === rememberedSelection.itemId
          : item.sourceId === rememberedSelection.sourceId) &&
        item.kind === rememberedSelection.kind
    );

    if (rememberedItemExists) {
      return rememberedSelection;
    }
  }

  const topmostItem = timelineItems[0];

  return topmostItem
    ? {
        itemId: topmostItem.id,
        sourceId: topmostItem.sourceId,
        kind: topmostItem.kind,
      }
    : null;
}

type MasterCompositionOptions = {
  masterCompId: string;
  masterWidth: number;
  masterHeight: number;
};

export function buildMasterComposition(
  sceneComps: Composition[],
  enabledProperties: PropertyTrackState,
  { masterCompId, masterWidth, masterHeight }: MasterCompositionOptions
): Composition {
  return {
    id: masterCompId,
    name: "Master Composition",
    type: "master",
    children: sceneComps,
    layers: [],
    position: {
      x: masterWidth / 2,
      y: masterHeight / 2,
    },
    positionKeyframes: [],
    transformOffset: {
      x: 0,
      y: 0,
    },
    anchor: {
      x: masterWidth / 2,
      y: masterHeight / 2,
    },
    scale: {
      x: 100,
      y: 100,
    },
    scaleKeyframes: [],
    scaleLinked: true,
    rotation: 0,
    rotationKeyframes: [],
    opacity: 100,
    opacityKeyframes: [],
    enabledProperties,
  };
}

type MasterTimelineItemsOptions = {
  masterCompId: string;
};

export function buildMasterTimelineItems(
  sceneComps: Composition[],
  existingItems: TimelineItem[],
  metaByCompId: Record<string, CompositionMeta>,
  { masterCompId }: MasterTimelineItemsOptions
) {
  const existingBySourceId = new Map(existingItems.map((item) => [item.sourceId, item]));
  let nextSequentialFrame = 0;

  return sceneComps.map((sceneComp) => {
    const existingItem = existingBySourceId.get(sceneComp.id);
    const durationFrames =
      existingItem?.durationFrames ??
      metaByCompId[sceneComp.id]?.durationFrames ??
      DEFAULT_DURATION_FRAMES;
    const startFrame = existingItem?.startFrame ?? nextSequentialFrame;

    nextSequentialFrame = startFrame + durationFrames;

    return {
      id: `${masterCompId}-timeline-${sceneComp.id}`,
      name: sceneComp.name,
      kind: "subComp" as const,
      visible: true,
      compId: masterCompId,
      sourceId: sceneComp.id,
      startFrame,
      durationFrames,
      targetCompId: sceneComp.id,
    };
  });
}

type MasterMetaOptions = {
  masterCompId: string;
  defaultFrameRate: number;
  masterWidth: number;
  masterHeight: number;
};

export function buildMasterMeta(
  sceneComps: Composition[],
  masterTimelineItems: TimelineItem[],
  metaByCompId: Record<string, CompositionMeta>,
  { masterCompId, defaultFrameRate, masterWidth, masterHeight }: MasterMetaOptions
): CompositionMeta {
  const firstSceneMeta = sceneComps[0] ? metaByCompId[sceneComps[0].id] : null;
  const storedMasterMeta = metaByCompId[masterCompId];
  const fallbackDurationFrames = Math.max(
    DEFAULT_DURATION_FRAMES,
    ...masterTimelineItems.map((item) => item.startFrame + item.durationFrames)
  );
  const durationFrames = storedMasterMeta?.durationFrames ?? fallbackDurationFrames;

  return {
    width: firstSceneMeta?.width ?? masterWidth,
    height: firstSceneMeta?.height ?? masterHeight,
    layerCount: sceneComps.length,
    sourceFileName: "Project",
    frameRate: storedMasterMeta?.frameRate ?? defaultFrameRate,
    durationFrames,
  };
}

export function reorderItems<T extends { id: string }>(
  items: T[],
  draggedId: string,
  targetId: string
) {
  const fromIndex = items.findIndex((item) => item.id === draggedId);
  const toIndex = items.findIndex((item) => item.id === targetId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return items;
  }

  const nextItems = [...items];
  const [draggedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, draggedItem);
  return nextItems;
}

export function reorderItemsWithPosition<T extends { id: string }>(
  items: T[],
  draggedId: string,
  targetId: string,
  position: "before" | "after"
) {
  const fromIndex = items.findIndex((item) => item.id === draggedId);
  const toIndex = items.findIndex((item) => item.id === targetId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return items;
  }

  const nextItems = [...items];
  const [draggedItem] = nextItems.splice(fromIndex, 1);
  const adjustedTargetIndex = nextItems.findIndex((item) => item.id === targetId);

  if (adjustedTargetIndex === -1) {
    return items;
  }

  nextItems.splice(position === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1, 0, draggedItem);
  return nextItems;
}

export function reorderRenderItems(renderItems: RenderItem[], timelineItems: TimelineItem[]) {
  const renderBySourceId = new Map(renderItems.map((item) => [item.sourceId, item]));

  return timelineItems
    .map((timelineItem) => renderBySourceId.get(timelineItem.sourceId))
    .filter((item): item is RenderItem => !!item);
}

export function visitCompositionTree(
  comp: Composition,
  visitor: (target: Composition) => void
) {
  visitor(comp);
  comp.children?.forEach((child) => visitCompositionTree(child, visitor));
}

export function removeCompDataFromRecord<T>(record: Record<string, T>, mainComp: Composition) {
  const nextRecord = { ...record };
  visitCompositionTree(mainComp, (comp) => {
    delete nextRecord[comp.id];
  });
  return nextRecord;
}

export function findCompositionById(
  comps: Composition[],
  compId: string
): Composition | null {
  for (const comp of comps) {
    if (comp.id === compId) {
      return comp;
    }

    const childMatch = comp.children ? findCompositionById(comp.children, compId) : null;

    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}
