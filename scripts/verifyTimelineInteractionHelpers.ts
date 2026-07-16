import assert from "node:assert/strict";
import type { Composition, TimelineItem } from "../src/models";
import type { RenderItem } from "../src/engines/project";
import {
  findTimelineComposition,
  findTimelineMainComposition,
  findTimelineSelectionIndex,
  flattenTimelineRenderDrawables,
  normalizeTimelineItemName,
  reorderTimelineItems,
  reorderTimelineRenderItems,
  resolveTimelineAutoScroll,
  resolveTimelineDragDelta,
  resolveTimelineItemMove,
  resolveTimelineKeyframeMove,
  resolveTimelineResizeEnd,
  resolveTimelineResizeStart,
  splitTimelineItem,
  visitTimelineComposition,
} from "../src/engines/timeline/helpers/timelineInteractionHelpers";

const first = {
  id: "item-a",
  sourceId: "layer-a",
  kind: "layer",
  name: "A",
  startFrame: 10,
  durationFrames: 20,
} as TimelineItem;
const second = { ...first, id: "item-b", sourceId: "layer-b", name: "B" };

assert.equal(resolveTimelineDragDelta(125, 100, 10), 3);
assert.equal(resolveTimelineDragDelta(94, 100, 10), -1);
assert.equal(resolveTimelineItemMove(10, -20, 100), 0);
assert.equal(resolveTimelineItemMove(95, 20, 100), 99);
assert.deepEqual(resolveTimelineResizeStart(10, 20, 5, 100), {
  startFrame: 15,
  durationFrames: 15,
});
assert.deepEqual(resolveTimelineResizeStart(10, 20, 30, 100), {
  startFrame: 29,
  durationFrames: 1,
});
assert.equal(resolveTimelineResizeEnd(20, -30, 10, 100), 1);
assert.equal(resolveTimelineResizeEnd(20, 100, 10, 100), 90);
assert.equal(resolveTimelineKeyframeMove(4, 80, 100, 10), 2);
assert.equal(resolveTimelineKeyframeMove(1, 0, 100, 10), 0);
assert.equal(resolveTimelineAutoScroll(5, 0, 200, 20, 12), -12);
assert.equal(resolveTimelineAutoScroll(195, 0, 200, 20, 12), 12);
assert.equal(resolveTimelineAutoScroll(100, 0, 200, 20, 12), 0);

assert.equal(findTimelineSelectionIndex([first, second], { itemId: second.id, sourceId: second.sourceId, kind: second.kind }), 1);
assert.equal(findTimelineSelectionIndex([first, second], { sourceId: first.sourceId, kind: first.kind }), 0);
assert.equal(findTimelineSelectionIndex([first, second], null), -1);
assert.deepEqual(reorderTimelineItems([first, second], first.id, second.id), [second, first]);
assert.equal(reorderTimelineItems([first, second], "missing", second.id)[0], first);

const renderA = { id: "render-a", sourceId: first.sourceId, kind: first.kind, drawables: [{ id: "draw-a" }] } as RenderItem;
const renderB = { id: "render-b", sourceId: second.sourceId, kind: second.kind, drawables: [{ id: "draw-b" }] } as RenderItem;
assert.deepEqual(reorderTimelineRenderItems([renderA, renderB], [second, first]), [renderB, renderA]);
assert.deepEqual(flattenTimelineRenderDrawables({ root: [{ ...renderA, kind: "subComp", targetCompId: "child" }], child: [renderB] }, "root"), renderB.drawables);

const child = { id: "child", type: "sub", parentId: "main", children: [] } as unknown as Composition;
const main = { id: "main", type: "main", children: [child] } as unknown as Composition;
assert.equal(findTimelineComposition([main], child.id), child);
assert.equal(findTimelineMainComposition([main], child), main);
const visited: string[] = [];
visitTimelineComposition(main, (composition) => visited.push(composition.id));
assert.deepEqual(visited, [main.id, child.id]);

assert.equal(normalizeTimelineItemName("  renamed  "), "renamed");
assert.equal(splitTimelineItem(first, first.startFrame, "right"), null);
assert.deepEqual(splitTimelineItem(first, 15, "right"), {
  left: { ...first, durationFrames: 5 },
  right: { ...first, id: "right", startFrame: 15, durationFrames: 15 },
});

console.log("Timeline interaction helper verification passed");
