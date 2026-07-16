import type { Composition, Layer, TimelineItem } from "@/models";

export function updateCompositionRecursively(
  comp: Composition,
  compId: string,
  reorderedTimelineItems: TimelineItem[]
): Composition {
  if (comp.id === compId) {
    const layerMap = new Map(comp.layers.map((layer) => [layer.id, layer]));
    const childMap = new Map((comp.children ?? []).map((child) => [child.id, child]));

    return {
      ...comp,
      layers: reorderedTimelineItems
        .filter((item) => item.kind === "layer")
        .map((item) => layerMap.get(item.sourceId))
        .filter((layer): layer is Composition["layers"][number] => !!layer),
      children: reorderedTimelineItems
        .filter((item) => item.kind === "subComp")
        .map((item) => childMap.get(item.sourceId))
        .filter((child): child is Composition => !!child),
    };
  }

  return {
    ...comp,
    children: (comp.children ?? []).map((child) =>
      updateCompositionRecursively(child, compId, reorderedTimelineItems)
    ),
  };
}

export function reorderCompositionState(
  comps: Composition[],
  compId: string,
  reorderedTimelineItems: TimelineItem[]
) {
  return comps.map((comp) =>
    updateCompositionRecursively(comp, compId, reorderedTimelineItems)
  );
}

export function updateLayerRecursively(
  comp: Composition,
  layerId: string,
  updater: (layer: Layer) => Layer
): Composition {
  return {
    ...comp,
    layers: comp.layers.map((layer) => (layer.id === layerId ? updater(layer) : layer)),
    children: comp.children?.map((child) => updateLayerRecursively(child, layerId, updater)),
  };
}

export function updateCompositionNodeRecursively(
  comp: Composition,
  targetCompId: string,
  updater: (target: Composition) => Composition
): Composition {
  if (comp.id === targetCompId) return updater(comp);

  return {
    ...comp,
    children: comp.children?.map((child) =>
      updateCompositionNodeRecursively(child, targetCompId, updater)
    ),
  };
}
