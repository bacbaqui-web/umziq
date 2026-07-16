import type { Composition, Layer } from "@/models";
import type {
  TimelineCompositionSwitcherViewModel,
  TimelineSelection,
} from "@/engines/timeline/models/timelineViewModel";

function collectCompositionPath(
  selectedComp: Composition | null,
  allCompositionsById: Map<string, Composition>
) {
  if (!selectedComp) return [];
  const path: string[] = [];
  let current: Composition | null = selectedComp;
  while (current) {
    if (current.type !== "master") path.unshift(current.name);
    current = current.parentId
      ? allCompositionsById.get(current.parentId) ?? null
      : null;
  }
  return path;
}

export function buildTimelineBreadcrumbPath(
  selectedComp: Composition | null,
  selectedTimelineTarget: TimelineSelection,
  allLayersById: Map<string, Layer>,
  allCompositionsById: Map<string, Composition>
) {
  if (!selectedComp || !selectedTimelineTarget) return null;
  const path = collectCompositionPath(selectedComp, allCompositionsById);
  if (selectedTimelineTarget.kind === "layer") {
    const layer = allLayersById.get(selectedTimelineTarget.sourceId);
    if (layer) path.push(layer.name);
    return path.length > 0 ? path.join(" > ") : null;
  }
  const targetComp = allCompositionsById.get(selectedTimelineTarget.sourceId) ?? null;
  if (targetComp && targetComp.id !== selectedComp.id && targetComp.type !== "master") {
    path.push(targetComp.name);
  }
  return path.length > 0 ? path.join(" > ") : null;
}

export function buildTimelineCompositionSwitcherViewModel(
  selectedComp: Composition | null,
  allCompositionsById: Map<string, Composition>,
  isOpen = false
): TimelineCompositionSwitcherViewModel {
  if (!selectedComp) return { parentName: null, parentIsCurrent: false, items: [], isOpen };
  const parentComp = selectedComp.parentId
    ? allCompositionsById.get(selectedComp.parentId) ?? null
    : null;
  const hasParentContext = !!parentComp && parentComp.type !== "master";
  const headerComp = hasParentContext ? parentComp : selectedComp;
  const itemSource = hasParentContext ? parentComp.children ?? [] : selectedComp.children ?? [];
  return {
    parentName: headerComp.name,
    parentIsCurrent: headerComp.id === selectedComp.id,
    items: itemSource
      .filter((comp) => comp.type !== "master")
      .map((comp) => ({ id: comp.id, name: comp.name, isActive: comp.id === selectedComp.id })),
    isOpen,
  };
}
