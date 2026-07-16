import { ANIMATABLE_PROPERTIES, getKeyframeGlobalFrame, getTargetKeyframes, resolveSelectedTransformLocalFrame } from "@/engines/animation";
import type { AnimatableProperty, Composition, Layer, TimelineItem } from "@/models";
import { buildTimelineHeaderViewModel, buildTimelineRows, buildTimelineTrackViewModels } from "@/engines/timeline/helpers/timelineViewModelHelpers";
import type {
  TimelineProjectReadPort,
  TimelineReadModel,
  TimelineRow,
  TimelineSelectionReadPort,
} from "@/engines/timeline/models/timelineViewModel";
import type { TimelineRulerViewModel, TimelineCompositionSwitcherViewModel } from "@/engines/timeline/models/timelineViewModel";

type Options = {
  nameColumnWidth: number;
  project: TimelineProjectReadPort;
  selection: TimelineSelectionReadPort;
  ruler: TimelineRulerViewModel;
  switcher: TimelineCompositionSwitcherViewModel;
  breadcrumbPath: string | null;
  currentFrame: number;
  playheadFrame: number;
  isPlaying: boolean;
  formatTime: (frame: number, frameRate: number) => string;
  interactionView: {
    editingItemId: string | null;
    draftName: string;
    deleteDecisionItemId: string | null;
  };
};

function resolveRowTarget(
  item: TimelineItem,
  allLayers: Map<string, Layer>,
  allCompositions: Map<string, Composition>
) {
  return item.kind === "layer"
    ? allLayers.get(item.sourceId) ?? null
    : allCompositions.get(item.sourceId) ?? null;
}

export function useTimelineViewController(options: Options) {
  const displayedRows: TimelineRow[] = buildTimelineRows({
    items: options.project.selectedTimelineItems,
    selection: options.selection.selectedTimelineTarget,
    properties: ANIMATABLE_PROPERTIES,
    allLayersById: options.project.allLayersById,
    allCompositionsById: options.project.allCompositionsById,
  });
  const selectedTimelineTargetItem = options.selection.selectedTimelineTarget
    ? options.project.selectedTimelineItems.find((item) =>
        (options.selection.selectedTimelineTarget?.itemId
          ? item.id === options.selection.selectedTimelineTarget.itemId
          : item.sourceId === options.selection.selectedTimelineTarget?.sourceId)
        && item.kind === options.selection.selectedTimelineTarget?.kind
      ) ?? null
    : null;
  const selectedTransformLocalFrame = resolveSelectedTransformLocalFrame(
    options.playheadFrame,
    selectedTimelineTargetItem
  );
  const draggingKeyframeDisplayFrame = options.selection.draggingKeyframe
    ? getKeyframeGlobalFrame(
        options.selection.draggingKeyframe.frame,
        options.project.selectedTimelineItems.find(
          (item) => item.sourceId === options.selection.draggingKeyframe?.targetId
        )
      )
    : null;
  const keyframesByRow = new Map<string, Array<{ frame: number }>>();
  displayedRows.forEach((row) => {
    if (row.type !== "property") return;
    const target = resolveRowTarget(
      row.item,
      options.project.allLayersById,
      options.project.allCompositionsById
    );
    if (target) {
      keyframesByRow.set(
        `${row.item.id}:${row.property}`,
        getTargetKeyframes(target, row.property as AnimatableProperty)
      );
    }
  });
  const tracks = buildTimelineTrackViewModels({
    rows: displayedRows,
    selectedTimelineTarget: options.selection.selectedTimelineTarget,
    selectedKeyframe: options.selection.selectedKeyframe,
    draggingKeyframe: options.selection.draggingKeyframe,
    draggingKeyframeDisplayFrame,
    draggedTimelineItemId: options.selection.draggedTimelineItemId,
    pxPerFrame: options.ruler.pxPerFrame,
    allLayersById: options.project.allLayersById,
    allCompositionsById: options.project.allCompositionsById,
    keyframesByRow,
    frameRate: options.project.selectedMeta?.frameRate ?? 1,
    formatTime: options.formatTime,
    editingItemId: options.interactionView.editingItemId,
    draftName: options.interactionView.draftName,
    deleteDecisionItemId: options.interactionView.deleteDecisionItemId,
  });
  const header = buildTimelineHeaderViewModel({
    selectedComp: options.project.selectedComposition,
    selectedMeta: options.project.selectedMeta,
    breadcrumbPath: options.breadcrumbPath,
    switcher: options.switcher,
    isPlaying: options.isPlaying,
    currentFrame: options.currentFrame,
    currentFrameText: options.formatTime(
      options.currentFrame,
      options.project.selectedMeta?.frameRate ?? 1
    ),
    canDuplicate: !!selectedTimelineTargetItem,
    canSplit: !!selectedTimelineTargetItem,
  });
  const readModel: TimelineReadModel = {
    available: !!options.project.selectedComposition && !!options.project.selectedMeta,
    selectedComposition: options.project.selectedComposition,
    selectedMeta: options.project.selectedMeta,
    nameColumnWidth: options.nameColumnWidth,
    header,
    ruler: options.ruler,
    rows: tracks.rows,
    overlay: { ...tracks.overlay, playheadLeft: Math.round(options.ruler.playheadLeft) - 1 },
  };

  return {
    readModel,
    selectedTimelineTargetItem,
    selectedTransformLocalFrame,
    draggingKeyframeDisplayFrame,
  };
}
