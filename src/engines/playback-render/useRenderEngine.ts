import { useMemo } from "react";
import type { Composition, CompositionMeta, Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import { buildLocalFrameBySourceId } from "@/engines/animation";
import { buildRenderFrame } from "@/engines/playback-render/controllers/buildRenderFrame";
import { resolveRenderItemsForComposition } from "@/engines/playback-render/helpers/renderSourceHelpers";

type UseRenderEngineOptions = {
  masterCompId: string;
  sceneCompositions: Composition[];
  selectedComp: Composition;
  selectedMeta: CompositionMeta | null;
  selectedTimelineItems: TimelineItem[];
  globalFrame: number;
  layerMap: Map<string, Layer>;
  compositionMap: Map<string, Composition>;
  metaByCompId: Record<string, CompositionMeta>;
  renderItemsByCompId: Record<string, RenderItem[]>;
};

export function useRenderEngine({
  masterCompId,
  sceneCompositions,
  selectedComp,
  selectedMeta,
  selectedTimelineItems,
  globalFrame,
  layerMap,
  compositionMap,
  metaByCompId,
  renderItemsByCompId,
}: UseRenderEngineOptions) {
  const renderItems = useMemo(
    () =>
      resolveRenderItemsForComposition({
        masterCompId,
        selectedCompId: selectedComp.id,
        sceneCompositions,
        renderItemsByCompId,
      }),
    [masterCompId, renderItemsByCompId, sceneCompositions, selectedComp.id]
  );
  const localFrameBySourceId = useMemo(
    () => buildLocalFrameBySourceId(selectedTimelineItems, globalFrame),
    [globalFrame, selectedTimelineItems]
  );
  const renderFrame = useMemo(
    () =>
      selectedMeta
        ? buildRenderFrame({
            compositionId: selectedComp.id,
            width: selectedMeta.width,
            height: selectedMeta.height,
            renderItems,
            timelineItems: selectedTimelineItems,
            layerMap,
            compositionMap,
            metaByCompId,
            globalFrame,
          })
        : null,
    [
      compositionMap,
      globalFrame,
      layerMap,
      metaByCompId,
      renderItems,
      selectedComp.id,
      selectedMeta,
      selectedTimelineItems,
    ]
  );

  return { renderFrame, renderItems, localFrameBySourceId };
}
