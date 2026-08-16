import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildPreviewQualityControlViewModel,
} from "@/engines/canvas/helpers/previewQualityControlHelpers";

const auto = buildPreviewQualityControlViewModel({
  preference: "auto",
  quality: "high",
});
assert.equal(auto.currentQuality, "high");
assert.deepEqual(
  auto.options.map((option) => option.preference),
  ["auto", "original", "high", "medium", "low"]
);
assert.deepEqual(
  auto.options.map((option) => option.label),
  ["자동", "원본", "상", "중", "하"]
);

const explicit = buildPreviewQualityControlViewModel({
  preference: "low",
  quality: "low",
});
assert.equal(explicit.preference, "low");
assert.equal(explicit.currentQuality, "low");

const componentSource = readFileSync(
  "src/features/preview/components/PreviewQualityControl.tsx",
  "utf8"
);
assert.doesNotMatch(componentSource, /<select/);
assert.match(componentSource, /aria-haspopup="listbox"/);
assert.match(componentSource, /aria-label="미리보기 품질"/);
assert.match(componentSource, /role="option"/);
assert.match(componentSource, /commands\.setPreference/);
assert.doesNotMatch(componentSource, /memoryLabel|0 B|생성 중|Bitmap|Cache|Project|Render/);

console.log("Preview quality control verification passed");
