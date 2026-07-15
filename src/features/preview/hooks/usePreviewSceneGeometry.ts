import { useMemo } from "react";
import {
  buildCompositionMotionPath,
  buildCompositionOverlay,
  buildLayerMotionPath,
  buildLayerOverlay,
  buildLocalFrameBySourceId,
} from "@/editor/preview/motionPathGeometry";
import { flattenRenderItemsToDrawables, getActiveRenderItems } from "@/editor/preview/previewRenderer";
import type { Composition, CompositionMeta, RenderItem, TimelineItem } from "@/editor/types/types";
import type { TransformTargetSelection } from "@/features/preview/types/previewControllerTypes";

type UsePreviewSceneGeometryOptions = {
  masterCompId: string;
  comps: Composition[];
  selectedComp: Composition;
  selectedMeta: CompositionMeta | null;
  selectedTransformTarget: TransformTargetSelection;
  selectedTimelineItems: TimelineItem[];
  playheadFrame: number;
  metaByCompId: Record<string, CompositionMeta>;
  renderItemsByCompId: Record<string, RenderItem[]>;
};

export function usePreviewSceneGeometry({
  masterCompId,
  comps,
  selectedComp,
  selectedMeta,
  selectedTransformTarget,
  selectedTimelineItems,
  playheadFrame,
  metaByCompId,
  renderItemsByCompId,
}: UsePreviewSceneGeometryOptions) {
  const selectedRenderItems = useMemo(
    () =>
      selectedComp.id === masterCompId
        ? comps.map((sceneComp) => ({
            id: `${masterCompId}-render-${sceneComp.id}`,
            name: sceneComp.name,
            kind: "subComp" as const,
            visible: true,
            sourceId: sceneComp.id,
            targetCompId: sceneComp.id,
            drawables: flattenRenderItemsToDrawables(renderItemsByCompId, sceneComp.id),
          }))
        : (renderItemsByCompId[selectedComp.id] ?? []),
    [comps, masterCompId, renderItemsByCompId, selectedComp.id]
  );

  const activeRenderItems = useMemo(
    () => getActiveRenderItems(selectedRenderItems, selectedTimelineItems, playheadFrame),
    [playheadFrame, selectedRenderItems, selectedTimelineItems]
  );

  const localFrameBySourceId = useMemo(
    () => buildLocalFrameBySourceId(selectedTimelineItems, playheadFrame),
    [playheadFrame, selectedTimelineItems]
  );

  const selectedPreviewOverlay = useMemo(
    () =>
      selectedTransformTarget?.kind === "layer"
        ? buildLayerOverlay(
            selectedTransformTarget.layer,
            selectedRenderItems,
            selectedTimelineItems,
            playheadFrame
          )
        : selectedTransformTarget?.kind === "composition"
          ? buildCompositionOverlay(
              selectedTransformTarget.composition,
              metaByCompId,
              localFrameBySourceId
            )
          : null,
    [
      localFrameBySourceId,
      metaByCompId,
      playheadFrame,
      selectedRenderItems,
      selectedTimelineItems,
      selectedTransformTarget,
    ]
  );

  const selectedPreviewMotionPath = useMemo(
    () =>
      selectedTransformTarget?.kind === "layer" && selectedMeta
        ? buildLayerMotionPath(
            selectedTransformTarget.layer,
            selectedRenderItems,
            selectedTimelineItems,
            selectedMeta.durationFrames,
            playheadFrame
          )
        : selectedTransformTarget?.kind === "composition" && selectedMeta
          ? buildCompositionMotionPath(
              selectedTransformTarget.composition,
              selectedTimelineItems,
              metaByCompId,
              selectedMeta.durationFrames,
              playheadFrame
            )
          : [],
    [
      metaByCompId,
      playheadFrame,
      selectedMeta,
      selectedRenderItems,
      selectedTimelineItems,
      selectedTransformTarget,
    ]
  );

  return {
    selectedRenderItems,
    activeRenderItems,
    localFrameBySourceId,
    selectedPreviewOverlay,
    selectedPreviewMotionPath,
  };
}
