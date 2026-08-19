import {
  projectVisibleLayerDocumentKeyframeFrame,
  type AnimatableProperty,
  type LayerDocument,
  type LayerDocumentTransformProperty,
} from "@/models";
import type {
  LayerDocumentTimelineConsumerViewProps,
  LayerDocumentTimelineRuntimeUiState,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";
import type {
  TimelinePropertyRowViewModel,
  TimelinePropertyVisualTokens,
  TimelineRulerViewModel,
  TimelineViewItem,
} from "@/engines/timeline/models/timelineViewModel";

const LABELS: Record<LayerDocumentTransformProperty, string> = {
  position: "위치",
  scale: "스케일",
  rotation: "회전",
  opacity: "불투명도",
};

const COLORS: Record<
  LayerDocumentTransformProperty,
  TimelinePropertyVisualTokens
> = {
  position: { accent: "#6ba9df", accentMuted: "rgba(107, 169, 223, 0.62)", label: "#c9def2" },
  scale: { accent: "#7eca9d", accentMuted: "rgba(126, 202, 157, 0.62)", label: "#d4ecdd" },
  rotation: { accent: "#e3a56a", accentMuted: "rgba(227, 165, 106, 0.62)", label: "#f1dbc6" },
  opacity: { accent: "#bc92dd", accentMuted: "rgba(188, 146, 221, 0.62)", label: "#eadbf8" },
};

function keyframeFrames(
  layer: LayerDocument,
  property: LayerDocumentTransformProperty
): readonly { readonly frame: number }[] {
  switch (property) {
    case "position": return layer.common.animation.positionKeyframes;
    case "scale": return layer.common.animation.scaleKeyframes;
    case "rotation": return layer.common.animation.rotationKeyframes;
    case "opacity": return layer.common.animation.opacityKeyframes;
  }
}

export function buildTimelineKeyframeRowViewModel(options: {
  item: TimelineViewItem;
  layer: LayerDocument;
  property: LayerDocumentTransformProperty;
  rowIndex: number;
  runtime: LayerDocumentTimelineRuntimeUiState;
  timeline: LayerDocumentTimelineConsumerViewProps;
  ruler: TimelineRulerViewModel;
  frameRate: number;
  formatTime: (frame: number, frameRate: number) => string;
}): TimelinePropertyRowViewModel {
  const placement = {
    startFrame: options.item.startFrame,
    durationFrames: options.item.durationFrames,
    sourceOffsetFrames: options.item.sourceOffsetFrames,
  };
  const drag =
    options.runtime.keyframeDrag?.layerDocumentId === options.item.id &&
    options.runtime.keyframeDrag.property === options.property
      ? options.runtime.keyframeDrag
      : null;
  const keyframes = keyframeFrames(options.layer, options.property).flatMap(
    (keyframe) => {
      if (drag && keyframe.frame === drag.originLocalFrame) return [];
      const globalFrame = projectVisibleLayerDocumentKeyframeFrame(
        keyframe.frame,
        placement
      );
      if (globalFrame === null) return [];
      return [{
        frame: keyframe.frame,
        left:
          options.ruler.timelineOriginLeft +
          globalFrame * options.ruler.pxPerFrame -
          7,
        title: options.formatTime(keyframe.frame, options.frameRate),
        selected:
          options.timeline.selectedTransformKeyframe?.layerDocumentId ===
            options.item.id &&
          options.timeline.selectedTransformKeyframe.property ===
            options.property &&
          options.timeline.selectedTransformKeyframe.localFrame ===
            keyframe.frame,
        dragging: false,
      }];
    }
  );
  const dragGlobalFrame = drag
    ? projectVisibleLayerDocumentKeyframeFrame(drag.localFrame, placement)
    : null;
  const dragLeft = dragGlobalFrame === null
    ? null
    : options.ruler.timelineOriginLeft +
      dragGlobalFrame * options.ruler.pxPerFrame;
  return {
    type: "property",
    item: options.item,
    property: options.property as AnimatableProperty,
    targetKind: options.item.entityKind === "composition" ? "composition" : "layer",
    rowIndex: options.rowIndex,
    label: LABELS[options.property],
    colors: COLORS[options.property],
    selectedTimelineItem: true,
    trackLeft:
      options.ruler.timelineOriginLeft +
      options.item.startFrame * options.ruler.pxPerFrame,
    trackWidth: options.item.durationFrames * options.ruler.pxPerFrame,
    keyframes,
    dragging: Boolean(drag),
    draggingDisplayLeft: dragLeft === null ? null : dragLeft - 7,
    draggingReadoutLeft: dragLeft === null ? null : dragLeft + 10,
    draggingReadoutText: drag
      ? options.formatTime(drag.localFrame, options.frameRate)
      : null,
  };
}
