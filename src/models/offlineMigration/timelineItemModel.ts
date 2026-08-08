export type TimelineItemKind = "layer" | "subComp";

/**
 * Canonical saved placement contract.
 *
 * itemId identifies one placement. sourceId identifies the shared ProjectSource.
 * sourceOffsetFrames maps group time to source-local time:
 * localFrame = groupFrame - startFrame + sourceOffsetFrames.
 */
export interface TimelineItemReference {
  itemId: string;
  sourceId: string;
  groupId: string;
  alias: string | null;
  visible: boolean;
  startFrame: number;
  durationFrames: number;
  sourceOffsetFrames: number;
}

/**
 * Runtime compatibility shape used by the current Composition/Layer engines.
 * New saved Project Source data uses TimelineItemReference.
 */
export interface TimelineItem {
  id: string;
  name: string;
  kind: TimelineItemKind;
  visible: boolean;
  compId: string;
  sourceId: string;
  startFrame: number;
  durationFrames: number;
  sourceOffsetFrames?: number;
  sourceSyncStatus?: SourceSyncStatus;
  targetCompId?: string;
}
import type { SourceSyncStatus } from "@/models/offlineMigration/compositionModel";
