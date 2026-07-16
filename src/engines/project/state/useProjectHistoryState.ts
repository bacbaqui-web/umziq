import { useRef } from "react";
import type {
  Composition,
  CompositionMeta,
  OpacityKeyframe,
  PropertyTrackState,
  RotationKeyframe,
  Scale,
  ScaleKeyframe,
  TimelineItem,
} from "@/models";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";
import type { TimelineSelection } from "@/models";

export type ProjectHistorySnapshot = {
  compId: string;
  comps: Composition[];
  masterEnabledProperties: PropertyTrackState;
  masterScale: Scale;
  masterScaleKeyframes: ScaleKeyframe[];
  masterScaleLinked: boolean;
  masterRotation: number;
  masterRotationKeyframes: RotationKeyframe[];
  masterOpacity: number;
  masterOpacityKeyframes: OpacityKeyframe[];
  selectedLayerId: string | null;
  selectedTimelineTarget: TimelineSelection;
  lastSelectedItem: NonNullable<TimelineSelection> | null;
  meta: CompositionMeta | null;
  playbackRange: { startFrame: number; endFrame: number } | null;
  timelineItems: TimelineItem[];
  renderItems: RenderItem[];
  currentFrame: number;
};

export type CompositionHistoryState = {
  past: ProjectHistorySnapshot[];
  future: ProjectHistorySnapshot[];
  pending: ProjectHistorySnapshot | null;
  pendingDirty: boolean;
};

export function useProjectHistoryState() {
  return useRef<Record<string, CompositionHistoryState>>({});
}
