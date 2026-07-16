import { useMemo } from "react";
import type { CompositionMeta, TimelineItem } from "@/models";
import type { TransformTargetSelection } from "@/engines/animation";
import type { RenderItem } from "@/engines/project";
import {
  buildCompositionSelectionOverlay,
  buildCanvasSelectionReadModel,
  buildLayerSelectionOverlay,
} from "@/engines/canvas/helpers/canvasSelectionHelpers";

export function useCanvasSelectionController({
  selectedTransformTarget,
  selectedTimelineItems,
  playheadFrame,
  metaByCompId,
  renderItems,
  localFrameBySourceId,
  selectedMeta,
  previewSize,
  viewportScale,
  viewportOffset,
}: {
  selectedTransformTarget: TransformTargetSelection;
  selectedTimelineItems: readonly TimelineItem[];
  playheadFrame: number;
  metaByCompId: Readonly<Record<string, CompositionMeta>>;
  renderItems: readonly RenderItem[];
  localFrameBySourceId: ReadonlyMap<string, number>;
  selectedMeta: CompositionMeta | null;
  previewSize: { width: number; height: number };
  viewportScale: number;
  viewportOffset: { x: number; y: number };
}) {
  const overlay = useMemo(
    () =>
      selectedTransformTarget?.kind === "layer"
        ? buildLayerSelectionOverlay(
            selectedTransformTarget.layer,
            renderItems,
            selectedTimelineItems,
            playheadFrame
          )
        : selectedTransformTarget?.kind === "composition"
          ? buildCompositionSelectionOverlay(
              selectedTransformTarget.composition,
              metaByCompId,
              localFrameBySourceId
            )
          : null,
    [
      localFrameBySourceId,
      metaByCompId,
      playheadFrame,
      renderItems,
      selectedTimelineItems,
      selectedTransformTarget,
    ]
  );

  return useMemo(
    () =>
      buildCanvasSelectionReadModel({
        overlay,
        selectedMeta,
        previewSize,
        viewportScale,
        viewportOffset,
      }),
    [overlay, previewSize, selectedMeta, viewportOffset, viewportScale]
  );
}
