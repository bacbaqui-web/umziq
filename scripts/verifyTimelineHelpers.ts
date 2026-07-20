import assert from "node:assert/strict";
import type { Composition, Layer, TimelineItem } from "@/models";
import {
  buildTimelineBreadcrumbPath,
  buildTimelineCompositionSwitcherViewModel,
} from "@/engines/timeline/helpers/timelineBreadcrumbHelpers";
import {
  buildTimelineTrackRowLayout,
  parseTimelineDurationParts,
  resolveTimelinePxPerFrame,
  splitTimelineDuration,
} from "@/engines/timeline/helpers/timelineLayoutHelpers";
import {
  buildTimelineSourceStatusViewModel,
  resolveTimelineSourceStatus,
} from "@/engines/timeline/helpers/timelineSourceStatusHelpers";

const child = { id: "child", name: "Child", type: "composition", parentId: "parent", children: [] } as unknown as Composition;
const sibling = { id: "sibling", name: "Sibling", type: "composition", parentId: "parent", children: [] } as unknown as Composition;
const parent = { id: "parent", name: "Parent", type: "composition", children: [child, sibling] } as unknown as Composition;
const layer = { id: "layer", name: "Logo", sourceSyncStatus: "updated" } as unknown as Layer;
const compositions = new Map([[parent.id, parent], [child.id, child], [sibling.id, sibling]]);
const layers = new Map([[layer.id, layer]]);

assert.equal(buildTimelineBreadcrumbPath(child, { kind: "layer", sourceId: layer.id }, layers, compositions), "Parent > Child > Logo");
assert.deepEqual(buildTimelineCompositionSwitcherViewModel(child, compositions, true), {
  parentName: "Parent",
  parentIsCurrent: false,
  items: [
    { id: "child", name: "Child", isActive: true },
    { id: "sibling", name: "Sibling", isActive: false },
  ],
  isOpen: true,
});

const item = { id: "item", sourceId: layer.id, kind: "layer" } as TimelineItem;
const rows = [
  { type: "item" as const, item },
  { type: "property" as const, item, property: "position" as const },
  { type: "item" as const, item: { ...item, id: "item-2" } },
];
const layout = buildTimelineTrackRowLayout(rows);
assert.deepEqual([...layout.gridRowByDisplayedIndex.entries()], [[0, 2], [1, 3], [2, 5]]);
assert.equal(layout.totalTrackGridRows, 4);
assert.deepEqual(splitTimelineDuration(75, 30), { seconds: 2, frames: 15 });
assert.equal(parseTimelineDurationParts("2", "15", 30), 75);
assert.equal(parseTimelineDurationParts("invalid", "0", 30), null);
assert.equal(resolveTimelinePxPerFrame(100, 500, 2), 5);
assert.equal(resolveTimelineSourceStatus(item, layers, compositions), "updated");
assert.equal(buildTimelineSourceStatusViewModel("new").badge?.label, "NEW");
assert.deepEqual(buildTimelineSourceStatusViewModel("deletePending"), {
  status: "deletePending",
  isDeletePending: true,
  badge: { label: "delete?", color: "#f2a3a9", background: "rgba(126, 44, 50, 0.42)" },
});

console.log("Timeline helper verification passed");
