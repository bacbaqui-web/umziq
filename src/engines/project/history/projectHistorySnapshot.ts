import type { Dispatch, SetStateAction } from "react";
import type {
  Composition,
  CompositionMeta,
  OpacityKeyframe,
  Position,
  PropertyTrackState,
  RotationKeyframe,
  Scale,
  ScaleKeyframe,
  TimelineItem,
} from "@/models";
import type { SelectedKeyframe } from "@/engines/animation";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";
import type { TimelineSelection } from "@/models";
import type { ProjectHistorySnapshot } from "@/engines/project/state/useProjectHistoryState";

export type ProjectHistoryReadState = {
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
  lastSelectedItemByCompId: Record<string, NonNullable<TimelineSelection>>;
  metaByCompId: Record<string, CompositionMeta>;
  playbackRangeByCompId: Record<string, { startFrame: number; endFrame: number }>;
  timelineItemsByCompId: Record<string, TimelineItem[]>;
  renderItemsByCompId: Record<string, RenderItem[]>;
  currentFrame: number;
};

export type ProjectHistoryRestorePort = {
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setMasterEnabledProperties: Dispatch<SetStateAction<PropertyTrackState>>;
  setMasterScale: Dispatch<SetStateAction<Scale>>;
  setMasterScaleKeyframes: Dispatch<SetStateAction<ScaleKeyframe[]>>;
  setMasterScaleLinked: Dispatch<SetStateAction<boolean>>;
  setMasterRotation: Dispatch<SetStateAction<number>>;
  setMasterRotationKeyframes: Dispatch<SetStateAction<RotationKeyframe[]>>;
  setMasterOpacity: Dispatch<SetStateAction<number>>;
  setMasterOpacityKeyframes: Dispatch<SetStateAction<OpacityKeyframe[]>>;
  setSelectedCompId: Dispatch<SetStateAction<string>>;
  setSelectedLayerId: Dispatch<SetStateAction<string | null>>;
  setSelectedTimelineTarget: Dispatch<SetStateAction<TimelineSelection>>;
  setLastSelectedItemByCompId: Dispatch<
    SetStateAction<Record<string, NonNullable<TimelineSelection>>>
  >;
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  setPositionDraft: Dispatch<SetStateAction<Position | null>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
  setMetaByCompId: Dispatch<SetStateAction<Record<string, CompositionMeta>>>;
  setPlaybackRangeByCompId: Dispatch<
    SetStateAction<Record<string, { startFrame: number; endFrame: number }>>
  >;
  setTimelineItemsByCompId: Dispatch<
    SetStateAction<Record<string, TimelineItem[]>>
  >;
  setRenderItemsByCompId: Dispatch<SetStateAction<Record<string, RenderItem[]>>>;
  setImportError: Dispatch<SetStateAction<string | null>>;
  setImportNotice: Dispatch<SetStateAction<string | null>>;
  setDraggedTimelineItemId: Dispatch<SetStateAction<string | null>>;
  setCurrentFrame: Dispatch<SetStateAction<number>>;
  setIsScrubbingTimeline: Dispatch<SetStateAction<boolean>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setHoveredFrame: Dispatch<SetStateAction<number | null>>;
  setDraggingKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  setRotationHandleReadout: Dispatch<SetStateAction<string | null>>;
  setOpacityHandleReadout: Dispatch<SetStateAction<string | null>>;
  setScaleHandleReadout: Dispatch<
    SetStateAction<{ handle: "x" | "y" | "xy"; text: string } | null>
  >;
  setPositionHandleReadout: Dispatch<SetStateAction<string | null>>;
  setMotionPathKeyframeReadout: Dispatch<SetStateAction<string | null>>;
  setDraggingMotionPathFrame: Dispatch<SetStateAction<number | null>>;
};

function clonePlainData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneRenderItems(items: RenderItem[]): RenderItem[] {
  return items.map((item) => ({
    ...item,
    drawables: item.drawables.map((drawable) => ({ ...drawable })),
  }));
}

export function captureProjectHistorySnapshot(
  compId: string,
  state: ProjectHistoryReadState
): ProjectHistorySnapshot {
  return {
    compId,
    comps: clonePlainData(state.comps),
    masterEnabledProperties: clonePlainData(state.masterEnabledProperties),
    masterScale: clonePlainData(state.masterScale),
    masterScaleKeyframes: clonePlainData(state.masterScaleKeyframes),
    masterScaleLinked: state.masterScaleLinked,
    masterRotation: state.masterRotation,
    masterRotationKeyframes: clonePlainData(state.masterRotationKeyframes),
    masterOpacity: state.masterOpacity,
    masterOpacityKeyframes: clonePlainData(state.masterOpacityKeyframes),
    selectedLayerId: state.selectedLayerId,
    selectedTimelineTarget: clonePlainData(state.selectedTimelineTarget),
    lastSelectedItem: clonePlainData(state.lastSelectedItemByCompId[compId] ?? null),
    meta: clonePlainData(state.metaByCompId[compId] ?? null),
    playbackRange: clonePlainData(state.playbackRangeByCompId[compId] ?? null),
    timelineItems: clonePlainData(state.timelineItemsByCompId[compId] ?? []),
    renderItems: cloneRenderItems(state.renderItemsByCompId[compId] ?? []),
    currentFrame: state.currentFrame,
  };
}

export function restoreProjectHistorySnapshot(
  snapshot: ProjectHistorySnapshot,
  port: ProjectHistoryRestorePort
) {
  port.setComps(snapshot.comps);
  port.setMasterEnabledProperties(snapshot.masterEnabledProperties);
  port.setMasterScale(snapshot.masterScale);
  port.setMasterScaleKeyframes(snapshot.masterScaleKeyframes);
  port.setMasterScaleLinked(snapshot.masterScaleLinked);
  port.setMasterRotation(snapshot.masterRotation);
  port.setMasterRotationKeyframes(snapshot.masterRotationKeyframes);
  port.setMasterOpacity(snapshot.masterOpacity);
  port.setMasterOpacityKeyframes(snapshot.masterOpacityKeyframes);
  port.setSelectedCompId(snapshot.compId);
  port.setSelectedLayerId(snapshot.selectedLayerId);
  port.setSelectedTimelineTarget(snapshot.selectedTimelineTarget);
  port.setLastSelectedItemByCompId((current) => {
    if (snapshot.lastSelectedItem) {
      return { ...current, [snapshot.compId]: snapshot.lastSelectedItem };
    }

    if (!(snapshot.compId in current)) return current;
    const next = { ...current };
    delete next[snapshot.compId];
    return next;
  });
  port.setSelectedKeyframe(null);
  port.setPositionDraft(null);
  port.setScaleDraft(null);
  port.setRotationDraft(null);
  port.setOpacityDraft(null);
  port.setMetaByCompId((current) =>
    snapshot.meta ? { ...current, [snapshot.compId]: snapshot.meta } : current
  );
  port.setPlaybackRangeByCompId((current) => {
    if (snapshot.playbackRange) {
      return { ...current, [snapshot.compId]: snapshot.playbackRange };
    }

    if (!(snapshot.compId in current)) return current;
    const next = { ...current };
    delete next[snapshot.compId];
    return next;
  });
  port.setTimelineItemsByCompId((current) => ({
    ...current,
    [snapshot.compId]: snapshot.timelineItems,
  }));
  port.setRenderItemsByCompId((current) => ({
    ...current,
    [snapshot.compId]: snapshot.renderItems,
  }));
  port.setImportError(null);
  port.setImportNotice(null);
  port.setDraggedTimelineItemId(null);
  port.setCurrentFrame(snapshot.currentFrame);
  port.setIsScrubbingTimeline(false);
  port.setIsPlaying(false);
  port.setHoveredFrame(null);
  port.setDraggingKeyframe(null);
  port.setRotationHandleReadout(null);
  port.setOpacityHandleReadout(null);
  port.setScaleHandleReadout(null);
  port.setPositionHandleReadout(null);
  port.setMotionPathKeyframeReadout(null);
  port.setDraggingMotionPathFrame(null);
}
