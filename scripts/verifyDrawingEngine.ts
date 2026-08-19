import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDrawingStroke } from "@/engines/drawing/helpers/drawingElementHelpers";

const root = process.cwd();
const stroke = createDrawingStroke({
  tool: "brush", color: "#123456", size: 9,
  points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
});
assert.deepEqual(stroke, {
  kind: "stroke", tool: "brush", color: "#123456", size: 9,
  points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
});

const engine = readFileSync(join(root, "src/engines/drawing/useDrawingEngine.ts"), "utf8");
assert.match(engine, /setPointerCapture/);
assert.match(engine, /releasePointerCapture/);
assert.match(engine, /replaceElements/);
assert.match(engine, /fillDrawingRegion/);
const renderer = readFileSync(join(root, "src/render/adapters/editorPlaceholderCanvas2dAdapter.ts"), "utf8");
assert.match(renderer, /document\.createElement\("canvas"\)/);
assert.doesNotMatch(renderer, /context\.clearRect\(0, 0, width, height\)/);
const toolbar = readFileSync(join(root, "src/features/drawing/components/DrawingToolbar.tsx"), "utf8");
for (const label of ["드로잉 모드", "브러시", "지우개", "페인트통"])
  assert.match(toolbar, new RegExp(label));
assert.match(toolbar, /drawing-size-popover/);
assert.match(toolbar, /disabled=\{!drawing\.canEnableMode\}/);
assert.match(toolbar, /drawing\.modeEnabled/);
assert.doesNotMatch(toolbar, /\+ 드로잉|실행 취소|다시 실행/);

const overlay = readFileSync(join(root, "src/features/preview/components/PreviewViewportLayers.tsx"), "utf8");
assert.match(overlay, /drawing\.modeEnabled && drawing\.geometry/);

const projectAddMenu = readFileSync(join(root, "src/features/library/components/LibraryProjectAddMenu.tsx"), "utf8");
for (const label of ["PSD 불러오기", "드로잉 레이어 만들기", "오디오 불러오기", "직접 녹음하기"])
  assert.match(projectAddMenu, new RegExp(label));

const libraryMenu = readFileSync(join(root, "src/features/library/components/LibraryLayerContextMenu.tsx"), "utf8");
for (const label of ["이름 바꾸기", "복제", "삭제", "드로잉 레이어로 변환"])
  assert.match(libraryMenu, new RegExp(label));

console.log("Drawing Engine verification passed");
