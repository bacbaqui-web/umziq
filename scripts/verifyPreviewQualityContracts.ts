import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PREVIEW_QUALITY_SCALE,
  RESOLVED_PREVIEW_QUALITIES,
} from "@/engines/canvas/constants/previewQualityConstants";
import type {
  PreviewQualityPreference,
} from "@/engines/canvas/models/previewQualityModel";
import {
  mapCanvasPreviewQualityToSourceSamplingQuality,
} from "@/engines/canvas/adapters/layerDocumentCanvasReadAdapter";

const preference: PreviewQualityPreference = "auto";
assert.equal(JSON.parse(JSON.stringify(preference)), "auto");
assert.deepEqual(RESOLVED_PREVIEW_QUALITIES, [
  "original",
  "high",
  "medium",
  "low",
]);
assert.deepEqual(PREVIEW_QUALITY_SCALE, {
  original: 1,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
});
RESOLVED_PREVIEW_QUALITIES.forEach((quality) => {
  assert.equal(
    mapCanvasPreviewQualityToSourceSamplingQuality(
      quality
    ),
    quality
  );
});

const controller = readFileSync(
  "src/engines/canvas/controllers/useCanvasRenderController.ts",
  "utf8"
);
assert.match(controller, /pixelScale/);
assert.match(controller, /previewQuality/);
assert.doesNotMatch(controller, /PreviewBitmap|sourceResolver/);

const runtime = readFileSync(
  "src/engines/canvas/useCanvasPreviewRuntime.ts",
  "utf8"
);
assert.match(runtime, /resolvePreviewQuality/);
assert.match(runtime, /createCompositionPreviewCacheRuntime/);
assert.match(runtime, /createPreviewSurfaceCacheRuntime/);
assert.doesNotMatch(runtime, /memoryEstimates|PreviewBuild|ImageBitmap/);

const composition = readFileSync(
  "src/engines/canvas/useLayerDocumentCanvasEngine.ts",
  "utf8"
);
assert.match(
  composition,
  /const previewQuality =\s*previewRuntime\.quality/
);
assert.match(
  composition,
  /pixelScale:\s*PREVIEW_QUALITY_SCALE\[previewQuality\]/
);
assert.doesNotMatch(composition, /settledPreviewZoom/);
assert.match(composition, /previewQuality,/);
assert.match(
  composition,
  /mapCanvasPreviewQualityToSourceSamplingQuality/
);
assert.match(composition, /kind:\s*"original" as const/);
assert.doesNotMatch(composition, /PreviewBitmap|previewSourceResolver/);

console.log("Preview quality and runtime boundary verification passed");
