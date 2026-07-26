import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolvePreviewQuality,
} from "@/engines/canvas/helpers/previewQualityHelpers";

assert.equal(resolvePreviewQuality("original", null), "original");
assert.equal(resolvePreviewQuality("high", 1), "high");
assert.equal(resolvePreviewQuality("medium", 16), "medium");
assert.equal(resolvePreviewQuality("low", 16), "low");

assert.equal(resolvePreviewQuality("auto", null), "medium");
assert.equal(resolvePreviewQuality("auto", Number.NaN), "medium");
assert.equal(resolvePreviewQuality("auto", 0), "medium");
assert.equal(resolvePreviewQuality("auto", 0.5), "low");
assert.equal(resolvePreviewQuality("auto", 2), "medium");
assert.equal(resolvePreviewQuality("auto", 4), "high");
assert.equal(resolvePreviewQuality("auto", 8), "original");
assert.equal(resolvePreviewQuality("auto", 16), "original");

for (const removedPath of [
  "src/engines/canvas/constants/previewAutomaticQualityConstants.ts",
  "src/engines/canvas/helpers/previewAutomaticQualityHelpers.ts",
  "src/engines/canvas/helpers/previewMemoryHelpers.ts",
  "src/engines/canvas/models/previewAutomaticQualityModel.ts",
  "src/engines/canvas/models/previewBuildModel.ts",
  "src/engines/canvas/models/previewMemoryModel.ts",
]) {
  assert.throws(
    () => readFileSync(removedPath, "utf8"),
    undefined,
    `${removedPath} must stay removed`
  );
}

console.log("Preview backing-scale automatic quality verification passed");
