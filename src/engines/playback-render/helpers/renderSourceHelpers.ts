import type { Composition } from "@/models";
import type { RenderItem } from "@/engines/project";
import { flattenRenderItemsToDrawables } from "@/engines/playback-render/helpers/activeTimelineItemHelpers";

export function resolveRenderItemsForComposition(options: {
  masterCompId: string;
  selectedCompId: string;
  sceneCompositions: readonly Composition[];
  renderItemsByCompId: Record<string, RenderItem[]>;
}) {
  const {
    masterCompId,
    selectedCompId,
    sceneCompositions,
    renderItemsByCompId,
  } = options;

  if (selectedCompId !== masterCompId) {
    return renderItemsByCompId[selectedCompId] ?? [];
  }

  return sceneCompositions.map((composition) => ({
    id: `${masterCompId}-render-${composition.id}`,
    name: composition.name,
    kind: "subComp" as const,
    visible: true,
    sourceId: composition.id,
    targetCompId: composition.id,
    drawables: flattenRenderItemsToDrawables(
      renderItemsByCompId,
      composition.id
    ),
  }));
}
