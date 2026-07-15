import type { Composition, Layer } from "@/editor/types/types";
import type { TimelineSelection } from "@/editor/types/editorViewTypes";

export type TimelineCompositionSwitcherItem = {
  id: string;
  name: string;
  isActive: boolean;
};

export type TimelineCompositionSwitcherModel = {
  parentName: string | null;
  parentIsCurrent: boolean;
  items: TimelineCompositionSwitcherItem[];
};

function collectCompositionPath(
  selectedComp: Composition | null,
  allCompositionsById: Map<string, Composition>
) {
  if (!selectedComp) {
    return [];
  }

  const path: string[] = [];
  let current: Composition | null = selectedComp;

  while (current) {
    if (current.type !== "master") {
      path.unshift(current.name);
    }

    current = current.parentId
      ? allCompositionsById.get(current.parentId) ?? null
      : null;
  }

  return path;
}

export function buildTimelineSelectionPath(
  selectedComp: Composition | null,
  selectedTimelineTarget: TimelineSelection,
  allLayersById: Map<string, Layer>,
  allCompositionsById: Map<string, Composition>
) {
  if (!selectedComp || !selectedTimelineTarget) {
    return null;
  }

  const path = collectCompositionPath(selectedComp, allCompositionsById);

  if (selectedTimelineTarget.kind === "layer") {
    const layer = allLayersById.get(selectedTimelineTarget.sourceId);

    if (!layer) {
      return path.length > 0 ? path.join(" > ") : null;
    }

    path.push(layer.name);
    return path.join(" > ");
  }

  const targetComp = allCompositionsById.get(selectedTimelineTarget.sourceId) ?? null;

  if (targetComp && targetComp.id !== selectedComp.id && targetComp.type !== "master") {
    path.push(targetComp.name);
  }

  return path.length > 0 ? path.join(" > ") : null;
}

export function buildTimelineCompositionSwitcherModel(
  selectedComp: Composition | null,
  allCompositionsById: Map<string, Composition>
) : TimelineCompositionSwitcherModel {
  if (!selectedComp) {
    return {
      parentName: null,
      parentIsCurrent: false,
      items: [],
    };
  }

  const parentComp = selectedComp.parentId
    ? allCompositionsById.get(selectedComp.parentId) ?? null
    : null;
  const hasParentContext = parentComp && parentComp.type !== "master";
  const headerComp = hasParentContext ? parentComp : selectedComp;
  const itemSource = hasParentContext ? parentComp.children ?? [] : selectedComp.children ?? [];

  const items = itemSource
    .filter((comp) => comp.type !== "master")
    .map((comp) => ({
      id: comp.id,
      name: comp.name,
      isActive: comp.id === selectedComp.id,
    }));

  return {
    parentName: headerComp.name,
    parentIsCurrent: headerComp.id === selectedComp.id,
    items,
  };
}
