import { useMemo } from "react";
import type { CompositionMeta, TimelineItem } from "@/models";
import type { TransformTargetSelection } from "@/engines/animation";
import type { RenderItem } from "@/engines/project";
import {
  buildCompositionSelectionOverlay,
  buildCanvasSelectionReadModel,
  buildLayerSelectionOverlay,
} from "@/engines/canvas/helpers/canvasSelectionHelpers";
import {
  resolveDraftOverlayForTarget,
  type DraftTransformSnapshot,
} from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";

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
  draftTransformSnapshot,
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
  draftTransformSnapshot: DraftTransformSnapshot | null;
}) {
  const overlay = useMemo(
    () =>
      selectedTransformTarget?.kind === "layer"
        ? buildLayerSelectionOverlay(
            selectedTransformTarget.layer,
            renderItems,
            selectedTimelineItems,
            playheadFrame,
            selectedMeta?.frameRate
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
      selectedMeta?.frameRate,
    ]
  );
  const runtimeOverlay = useMemo(
    () =>
      resolveDraftOverlayForTarget(
        selectedTransformTarget,
        draftTransformSnapshot
      ) ?? overlay,
    [draftTransformSnapshot, overlay, selectedTransformTarget]
  );

  return useMemo(
    () =>
      buildCanvasSelectionReadModel({
        overlay: runtimeOverlay,
        selectedMeta,
        previewSize,
        viewportScale,
        viewportOffset,
      }),
    [previewSize, runtimeOverlay, selectedMeta, viewportOffset, viewportScale]
  );
}
