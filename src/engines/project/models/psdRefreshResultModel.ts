import type { Composition, CompositionMeta, Layer, SourceSyncStatus, TimelineItem, TimelineItemKind } from "@/models";
import type { RenderDrawable, RenderItem } from "@/engines/project/models/runtimeRenderModel";

export type ProjectDataState = {
  comps: Composition[];
  metaByCompId: Record<string, CompositionMeta>;
  timelineItemsByCompId: Record<string, TimelineItem[]>;
  renderItemsByCompId: Record<string, RenderItem[]>;
};

export type PsdRefreshCounts = {
  newGroups: number;
  newLayers: number;
  updated: number;
  missing: number;
  deletePending: number;
};

export type PsdRefreshSummary = PsdRefreshCounts & {
  compositionId: string;
  compositionName: string;
  problematic: number;
};

export type PsdRefreshCommandResult =
  | { status: "completed"; summary: PsdRefreshSummary | null }
  | { status: "needsSource"; summary: null };

export type PsdRefreshMergeResult = ProjectDataState & {
  counts: PsdRefreshCounts;
};

export type PsdCompositionMergeResult = ProjectDataState & {
  composition: Composition;
  counts: PsdRefreshCounts;
};

export type PsdSourceEntity = Layer | Composition;

export type PsdDirectSourceDescriptor = {
  kind: TimelineItemKind;
  sourcePath: string;
  entity: PsdSourceEntity;
  sourceStatus: SourceSyncStatus;
  isNewSource: boolean;
  isMissingSource: boolean;
  nextVisible: boolean;
  nextDrawables: RenderDrawable[] | null;
  newTimelineItemTemplate: TimelineItem | null;
  newRenderItemTemplate: RenderItem | null;
};
