import type { TimelineRow } from "@/engines/timeline/models/timelineViewModel";

export type TimelineTrackRowLayout = {
  gridRowByDisplayedIndex: Map<number, number>;
  totalTrackGridRows: number;
};

export function isTimelineGroupEndRow(rows: TimelineRow[], index: number) {
  const current = rows[index];
  const next = rows[index + 1];
  return !next || next.type === "item" || next.item.id !== current.item.id;
}

export function buildTimelineTrackRowLayout(rows: TimelineRow[]): TimelineTrackRowLayout {
  const gridRowByDisplayedIndex = new Map<number, number>();
  let nextGridRow = 2;
  rows.forEach((_, index) => {
    gridRowByDisplayedIndex.set(index, nextGridRow);
    nextGridRow += 1;
    if (isTimelineGroupEndRow(rows, index) && index < rows.length - 1) nextGridRow += 1;
  });
  return { gridRowByDisplayedIndex, totalTrackGridRows: nextGridRow - 2 };
}

export function buildTimelineRulerFrames(durationFrames: number, frameRate: number) {
  return Array.from({ length: durationFrames }, (_, frame) => {
    const second = frame % frameRate === 0;
    const ten = frame % 10 === 0;
    return {
      frame,
      label: second ? `${frame / frameRate}s` : "",
      tickTop: second ? 0 : ten ? 8 : 14,
      tickHeight: second ? 30 : ten ? 22 : 16,
      tickColor: second
        ? "rgba(255,255,255,0.22)"
        : ten
          ? "rgba(255,255,255,0.12)"
          : "rgba(255,255,255,0.06)",
    };
  });
}

export function splitTimelineDuration(durationFrames: number, frameRate: number) {
  const safeRate = Math.max(frameRate, 1);
  const safeDuration = Math.max(durationFrames, 1);
  return { seconds: Math.floor(safeDuration / safeRate), frames: safeDuration % safeRate };
}

export function parseTimelineDurationParts(seconds: string, frames: string, frameRate: number) {
  const nextSeconds = Number(seconds.trim());
  const nextFrames = Number(frames.trim());
  if (!Number.isFinite(nextSeconds) || !Number.isFinite(nextFrames) || nextSeconds < 0 || nextFrames < 0) {
    return null;
  }
  return Math.max(1, Math.floor(nextSeconds) * Math.max(frameRate, 1) + Math.floor(nextFrames));
}

export function resolveTimelinePxPerFrame(
  durationFrames: number,
  availableWidth: number,
  defaultPxPerFrame: number
) {
  if (durationFrames <= 0) return defaultPxPerFrame;
  return Math.max(
    (availableWidth > 0 ? availableWidth : durationFrames * defaultPxPerFrame) / durationFrames,
    0.001
  );
}
