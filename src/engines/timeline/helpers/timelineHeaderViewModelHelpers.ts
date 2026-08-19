import type {
  LayerDocument,
  LayerDocumentProject,
} from "@/models";
import type {
  LayerDocumentTimelineConsumerViewProps,
  LayerDocumentTimelinePlaybackReadModel,
  LayerDocumentTimelineRuntimeUiState,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";
import type {
  TimelineHeaderViewModel,
} from "@/engines/timeline/models/timelineViewModel";

export function buildTimelineHeaderViewModel(options: {
  project: LayerDocumentProject;
  timeline: LayerDocumentTimelineConsumerViewProps;
  runtime: LayerDocumentTimelineRuntimeUiState;
  playback: LayerDocumentTimelinePlaybackReadModel;
  frameRate: number;
  formatTime: (frame: number, frameRate: number) => string;
}): TimelineHeaderViewModel {
  if (!options.timeline.scope.ok) {
    return {
      visible: false,
      compositionName: null,
      breadcrumbSegments: [],
      selectionLabel: null,
      switcher: { items: [], isOpen: false },
      isPlaying: options.playback.isPlaying,
      currentFrame: options.playback.currentFrame,
      currentFrameText: "",
      canDuplicateSelectedItem: false,
      canSplitSelectedItem: false,
    };
  }
  const scope = options.timeline.scope.model;
  const selectedId = options.timeline.selectedLayerDocumentId;
  const selected = selectedId
    ? options.project.payload.layerDocumentsById[selectedId] ?? null
    : null;
  const currentFrame = options.playback.currentFrame;
  const canSplit = Boolean(
    selected &&
    selected.common.placement.parentLayerDocumentId ===
      scope.activeGroupLayerDocumentId &&
    currentFrame > selected.common.placement.startFrame &&
    currentFrame <
      selected.common.placement.startFrame +
        selected.common.placement.durationFrames
  );
  const childGroups = options.timeline.rows
    .map((row) =>
      options.project.payload.layerDocumentsById[row.layerDocumentId]
    )
    .filter(
      (layer): layer is Extract<LayerDocument, { type: "group" }> =>
        layer?.type === "group"
    );
  return {
    visible: true,
    compositionName:
      scope.activeGroup.common.placement.alias ?? scope.activeGroup.name,
    breadcrumbSegments: scope.breadcrumb.map((segment) => ({
      id: segment.layerDocumentId,
      name: segment.role === "project-root" ? "프로젝트" : segment.label,
      isCurrent:
        segment.layerDocumentId === scope.activeGroupLayerDocumentId,
      entityKind: "composition",
    })),
    selectionLabel: selected
      ? {
          label: selected.common.placement.alias ?? selected.name,
          entityKind:
            selected.type === "group"
              ? "composition"
              : selected.type === "audio"
                ? "audio"
                : "layer",
          audioProvenance:
            selected.type === "audio"
              ? (() => {
                  const sourceId = selected.common.source?.sourceId;
                  const source = sourceId
                    ? options.project.payload.sourceRegistry.sourcesById[sourceId]
                    : null;
                  return source?.kind === "audio"
                    ? source.data.provenance
                    : null;
                })()
              : null,
        }
      : null,
    switcher: {
      isOpen: options.runtime.isCompositionSwitcherOpen,
      items: childGroups.map((group) => ({
        id: group.layerDocumentId,
        name: group.common.placement.alias ?? group.name,
        depth: 0,
        isCurrent: false,
        isAncestor: false,
      })),
    },
    isPlaying: options.playback.isPlaying,
    currentFrame,
    currentFrameText: options.formatTime(currentFrame, options.frameRate),
    canDuplicateSelectedItem: Boolean(
      selected &&
        selected.common.placement.parentLayerDocumentId ===
          scope.activeGroupLayerDocumentId
    ),
    canSplitSelectedItem: canSplit,
  };
}
