import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const node = readFileSync("src/features/library/components/LibraryNode.tsx", "utf8");
const nodeRow = readFileSync("src/features/library/components/LibraryNodeRow.tsx", "utf8");
const tree = readFileSync("src/features/library/components/LibraryTree.tsx", "utf8");
const connector = readFileSync("src/features/library/components/LibraryTreeConnector.tsx", "utf8");
const previewCard = readFileSync("src/features/library/components/LibraryHoverPreviewCard.tsx", "utf8");
const hoverController = readFileSync("src/engines/library/controllers/useLibraryHoverPreviewController.ts", "utf8");
const audioImportController = readFileSync("src/engines/library/controllers/useLibraryAudioImportController.ts", "utf8");
const treeProjection = readFileSync("src/engines/library/helpers/libraryTreeProjectionHelpers.ts", "utf8");
const runtime = readFileSync("src/engines/library/runtime/libraryHoverPreviewRuntime.ts", "utf8");
const sharedCard = readFileSync("src/shared/components/LayerHoverPreviewCard.tsx", "utf8");
const sharedHelpers = readFileSync("src/shared/helpers/layerHoverPreviewHelpers.ts", "utf8");
const psdDialog = readFileSync("src/features/library/components/PsdImportPreviewDialog.tsx", "utf8");
const runtimeInput = readFileSync("src/render/adapters/layerDocumentRuntimeInputAdapter.ts", "utf8");

assert.match(hoverController, /setTimeout\(\(\) => \{[\s\S]*?\}, 180\)/, "Library hover preview must use a short intentional delay");
assert.match(sharedHelpers, /clientX \+ diagonalGap/, "Preview must open to the right of the pointer");
assert.match(sharedHelpers, /clientY - diagonalGap - options\.cardHeight/, "Preview must open above the pointer");
assert.match(previewCard, /<LayerHoverPreviewCard/, "Library visual previews must use the shared card");
assert.match(psdDialog, /<LayerHoverPreviewCard/, "PSD import visual previews must use the shared card");
assert.match(sharedCard, /빈 레이어/, "The shared visual card must own the empty-layer message");
assert.match(sharedHelpers, /Math\.min\(100, \(options\.height \/ options\.width\) \* 104\)/, "Shared card height must follow the layer aspect ratio at half-size");
assert.match(previewCard, /preview\.waveform\.map/, "Audio preview must render a waveform");
assert.match(sharedCard, /원본 파일을 찾을 수 없습니다/, "Missing visual resources must be explained by the shared card");
assert.match(previewCard, /preview\.status === "ready" \? "ready" : "empty"/, "Library visual preview must present unavailable pixels with the same empty-layer design as PSD preview");
assert.match(nodeRow, /const preview = node\.preview\(\)/, "Preview resolution must stay lazy until hover");
assert.match(treeProjection, /preview: readPreview\s*\? \(\) => readPreview/, "Library projection must expose lazy preview readers");
assert.match(runtime, /readAudioWaveform\(sourceId, 96\)/, "Audio waveform must reuse the runtime waveform cache");
assert.match(runtime, /renderVisual\(project, child\)/, "Group previews must composite descendants");
assert.match(
  runtime,
  /for \(let index = children\.length - 1; index >= 0; index -= 1\)/,
  "Group hover preview must paint bottom-to-top so the first Library row stays in front"
);
assert.match(audioImportController, /const preparedImports: PreparedLayerDocumentAudioImport\[\] = \[\]/, "Multi-file audio import must retain every prepared file");
assert.match(audioImportController, /for \(const prepared of preparedImports\)/, "Multi-file audio import must confirm every prepared file");
assert.match(node, /usesOuterProjectConnector = projectRootChild && !isMain/, "Project-root loose assets must use the outer tree connector only");
assert.match(tree, /projectRootChild/, "Top-level Library nodes must identify the project-root connector boundary");
assert.match(tree, /!\(node\.contentKind === "audio" && node\.type !== "main"\)/, "Project-root audio must not branch from the left project trunk");
assert.match(connector, /usesOuterProjectConnector && \(/, "Project-root audio must render its own top-down elbow connector");
assert.match(runtimeInput, /if \(layer\.type === "audio"\) \{\s*return \{ kind: "unsupported", layerType: "audio" \};/, "Audio Layers must not create Canvas visuals");

console.log("Library hover preview verification passed");
