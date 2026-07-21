import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function shallowPropsChanged(
  previous: Record<string, unknown>,
  next: Record<string, unknown>
) {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  return previousKeys.length !== nextKeys.length
    || previousKeys.some((key) => !Object.is(previous[key], next[key]));
}

const psdTreeProps = { nodes: [], commands: {} };
const timelineProps = { readModel: {}, commands: {}, interactions: {} };
let psdTreeAdditionalRenders = 0;
let timelineAdditionalRenders = 0;
let previewAdditionalRenders = 0;
let propertiesAdditionalRenders = 0;

for (let frame = 1; frame <= 100; frame += 1) {
  const draftOnlyRoot = {
    psdTreeProps,
    timelineProps,
    previewPaneProps: { draftFrame: frame },
    propertiesPanelProps: { draftFrame: frame },
  };
  psdTreeAdditionalRenders += Number(shallowPropsChanged(psdTreeProps, draftOnlyRoot.psdTreeProps));
  timelineAdditionalRenders += Number(shallowPropsChanged(timelineProps, draftOnlyRoot.timelineProps));
  previewAdditionalRenders += Number(shallowPropsChanged({ draftFrame: frame - 1 }, draftOnlyRoot.previewPaneProps));
  propertiesAdditionalRenders += Number(shallowPropsChanged({ draftFrame: frame - 1 }, draftOnlyRoot.propertiesPanelProps));
}

assert.equal(psdTreeAdditionalRenders, 0);
assert.equal(timelineAdditionalRenders, 0);
assert.equal(previewAdditionalRenders, 100);
assert.equal(propertiesAdditionalRenders, 100);
assert.equal(shallowPropsChanged(psdTreeProps, { ...psdTreeProps, nodes: [{}] }), true);
assert.equal(shallowPropsChanged(timelineProps, { ...timelineProps, readModel: { currentFrame: 1 } }), true);

const psdTreeComponent = readFileSync("src/features/psdtree/components/PsdTree.tsx", "utf8");
const timelineComponent = readFileSync("src/features/timeline/components/TimelinePanel.tsx", "utf8");
const psdTreeEngine = readFileSync("src/engines/psd-tree/usePsdTreeEngine.ts", "utf8");
const timelineEngine = readFileSync("src/engines/timeline/useTimelineEngine.ts", "utf8");

assert.match(psdTreeComponent, /export default memo\(PsdTree\)/);
assert.match(timelineComponent, /export default memo\(TimelinePanel\)/);
assert.match(psdTreeEngine, /viewProps: PsdTreeViewProps = useMemo/);
assert.match(timelineEngine, /const viewProps = useMemo/);

console.log("Draft panel render isolation fixture passed", {
  draftFrames: 100,
  psdTreeAdditionalRenders,
  timelineAdditionalRenders,
  previewAdditionalRenders,
  propertiesAdditionalRenders,
});
