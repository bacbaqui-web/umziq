import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const nativeFiles = [
  "src/engines/timeline/useLayerDocumentTimelineEngine.ts",
  "src/engines/timeline/helpers/layerDocumentTimelineViewModelHelpers.ts",
  "src/engines/timeline/models/layerDocumentTimelineEngineModel.ts",
  "src/engines/timeline/adapters/layerDocumentTimelinePlaybackAdapter.ts",
  "src/engines/timeline/adapters/layerDocumentTimelineInteractionController.ts",
  "src/engines/timeline/adapters/layerDocumentTimelineNavigationController.ts",
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

console.log(
  "LayerDocument Timeline UI boundary verification passed"
);
