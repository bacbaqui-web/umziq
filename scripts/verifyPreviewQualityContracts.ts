import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  PREVIEW_QUALITY_SCALE,
  RESOLVED_PREVIEW_QUALITIES,
} from "@/engines/canvas/constants/previewQualityConstants";
import type { PreviewQualityPreference } from "@/engines/canvas/models/previewQualityModel";
import type { PreviewRuntimeResource } from "@/engines/canvas/models/previewRuntimeModel";

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

const runtimeResource = {
  key: "layer-a:high",
  generation: 1,
  sourceId: "layer-a",
  sourceFingerprint: "fingerprint-a",
  quality: "high",
  estimatedBytes: 200,
  allocatedBytes: 200,
  bitmap: {
    image: { width: 5, height: 10 } as HTMLCanvasElement,
    pixelSize: { width: 5, height: 10 },
    logicalSize: { width: 20, height: 40 },
    dispose: () => undefined,
  },
} satisfies PreviewRuntimeResource;
assert.equal(runtimeResource.bitmap.image.width, 5);
assert.deepEqual(runtimeResource.bitmap.logicalSize, { width: 20, height: 40 });

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

const forbiddenDirectories = [
  join(process.cwd(), "src/models"),
  join(process.cwd(), "src/engines/project"),
  join(process.cwd(), "src/engines/project/history"),
];
const forbiddenRuntimeNames = /PreviewBitmapRuntime|PreviewRuntimeResource/;
const boundaryViolations = forbiddenDirectories.flatMap((directory) =>
  collectSourceFiles(directory)
    .filter((file) => forbiddenRuntimeNames.test(readFileSync(file, "utf8")))
);
assert.deepEqual(boundaryViolations, []);

console.log("Preview quality and runtime boundary verification passed");
