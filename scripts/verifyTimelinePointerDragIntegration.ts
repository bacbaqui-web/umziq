import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const engine = read(
  "src/engines/timeline/useLayerDocumentTimelineEngine.ts"
);
const timelinePointerRuntime = read(
  "src/engines/timeline/state/useLayerDocumentTimelinePointerRuntime.ts"
);
const playback = read(
  "src/engines/timeline/controllers/useTimelinePlaybackUIController.ts"
);
const itemRow = read(
  "src/features/timeline/components/TimelineItemTrackClip.tsx"
);
const propertyRow = read(
  "src/features/timeline/components/TimelinePropertyTrackRow.tsx"
);
const ruler = read(
  "src/features/timeline/components/TimelineRuler.tsx"
);
const mouthClip = read(
  "src/features/timeline/components/TimelineFormulaTrackRow.tsx"
);
const accelerationClip = read(
  "src/features/timeline/components/TimelineAccelerationTrackRow.tsx"
);
const formulaClip = read(
  "src/features/timeline/components/TimelineFormulaClip.tsx"
);

assert.match(
  timelinePointerRuntime,
  /useTimelinePointerDragSessionRuntime\(\{/
);
assert.equal(
  [...playback.matchAll(/useTimelinePointerDragSessionRuntime\(\{/g)].length,
  2,
  "playhead and range both use the common drag session controller"
);
assert.match(formulaClip, /useTimelinePointerDragSessionRuntime<FormulaClipDragSession<TDraft, TKind>>/);
assert.match(mouthClip, /<TimelineFormulaClip<ClipDraft, ClipDragKind>/);
assert.match(accelerationClip, /<TimelineFormulaClip<AccelerationClipDraft, AccelerationClipDragKind>/);

for (const [name, source] of [
  ["Timeline engine", engine],
  ["Timeline pointer runtime", timelinePointerRuntime],
  ["Playback UI", playback],
  ["Formula clip", formulaClip],
] as const) {
  assert.doesNotMatch(
    source,
    /addEventListener\((?:"|')(?:mouse|pointer|blur|visibility|lostpointercapture)/,
    `${name} must not own DOM drag listeners`
  );
}

assert.match(itemRow, /onPointerDown=/);
assert.doesNotMatch(
  itemRow.slice(itemRow.indexOf("beginMoveTimelineItem")),
  /onMouseDown=/
);
assert.match(propertyRow, /beginMoveKeyframe\(\{ clientX:/);
assert.match(ruler, /commands\.beginScrub\(\{ clientX:/);
assert.match(ruler, /commands\.beginRangeResize\(\{ clientX:/);

assert.match(formulaClip, /if \(changed\(session\.initial, session\.latest\)\) commit\(session\.latest\);/);
assert.match(formulaClip, /select\(\);\s*pointer\.begin\(/);
assert.match(mouthClip, /changed=\{clipChanged\}/);
assert.match(accelerationClip, /changed=\{\(initial, latest\) =>/);

console.log(
  "Timeline Pointer Drag integration verification passed"
);
