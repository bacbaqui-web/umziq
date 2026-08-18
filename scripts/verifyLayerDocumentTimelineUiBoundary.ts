import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const nativeFiles = [
  "src/engines/timeline/useLayerDocumentTimelineEngine.ts",
  "src/engines/timeline/helpers/layerDocumentTimelineViewModelHelpers.ts",
  "src/engines/timeline/models/layerDocumentTimelineEngineModel.ts",
  "src/engines/timeline/state/layerDocumentTimelinePlaybackRuntime.ts",
  "src/engines/timeline/controllers/layerDocumentTimelineInteractionController.ts",
  "src/engines/timeline/controllers/layerDocumentTimelineNavigationController.ts",
  "src/engines/timeline/adapters/layerDocumentTimelineSourceStatusAdapter.ts",
];
nativeFiles.forEach((file) => {
  const source = readFileSync(file, "utf8");
  assert.equal(
    /canonicalTimelineItemsToLegacyRows|\bTimelineItem\b|ProjectSource|sourceId\s*===\s*selected/.test(
      source
    ),
    false,
    `${file} must remain free of Legacy/shadow Timeline projections`
  );
});
const nativeHook = readFileSync(
  "src/engines/timeline/useLayerDocumentTimelineEngine.ts",
  "utf8"
);
assert.equal(
  /useState\s*\(\s*false\s*\).*isPlaying|setIsPlaying/.test(
    nativeHook
  ),
  false,
  "native Timeline hook must receive transport state from its playback port"
);
assert.match(
  nativeHook,
  /createLayerDocumentTimelineInteractionController/,
  "native hook and deterministic harness must share the public interaction controller"
);
assert.match(
  nativeHook,
  /createLayerDocumentTimelineNavigationController/,
  "switcher focus behavior must use the shared navigation controller"
);
const sourceStatusAdapter = readFileSync(
  "src/engines/timeline/adapters/layerDocumentTimelineSourceStatusAdapter.ts",
  "utf8"
);
assert.equal(
  /refreshSource|deleteSource|delete-layer/.test(
    sourceStatusAdapter
  ),
  false,
  "Source acknowledgment must not refresh/delete Source content or dispatch Layer deletion"
);
const itemComponent = readFileSync(
  "src/features/timeline/components/TimelineItemTrackRow.tsx",
  "utf8"
);
assert.match(
  itemComponent,
  /deleteTimelineItem\(item\.id\)/,
  "Layer row deletion must be separate from Source status reconciliation"
);
assert.match(
  itemComponent,
  /gridColumn: 2,[\s\S]*?width: contentWidth,[\s\S]*?overflow: "visible"/,
  "Layer tracks must show Placement content outside the active Timeline duration"
);
assert.match(
  itemComponent,
  /visibleTrackWidth/,
  "Layer tracks must distinguish the visible parent-Timeline intersection"
);
const formulaComponent = readFileSync(
  "src/features/timeline/components/TimelineFormulaClip.tsx",
  "utf8"
);
assert.match(
  formulaComponent,
  /gridColumn: 2,[\s\S]*?width: contentWidth,[\s\S]*?overflow: "visible"/,
  "Formula clips must remain visible outside the active Timeline duration"
);
const propertyComponent = readFileSync(
  "src/features/timeline/components/TimelinePropertyTrackRow.tsx",
  "utf8"
);
assert.match(
  propertyComponent,
  /zIndex: viewModel\.dragging \? 50 : 2[\s\S]*?overflow: viewModel\.dragging \? "visible" : "hidden"/,
  "Keyframe drag readouts must rise above adjacent Timeline rows"
);

console.log(
  "LayerDocument Timeline UI boundary verification passed"
);
