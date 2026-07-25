import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateLayerDocumentProject,
} from "@/models";
import {
  createInitialLayerDocumentOwnerOptions,
} from "@/editor/layerDocumentEditorBootstrap";

const source = (path: string) =>
  readFileSync(path, "utf8");
const root = source(
  "src/editor/useEditorCompositionRoot.ts"
);
const owner = source(
  "src/editor/useLayerDocumentEditorOwner.ts"
);
const canvas = source(
  "src/engines/canvas/useLayerDocumentCanvasComposition.ts"
);
const timeline = source(
  "src/engines/timeline/useLayerDocumentTimelineEngine.ts"
);
const properties = source(
  "src/engines/properties/adapters/useLayerDocumentPropertiesEngine.ts"
);
const shell = source(
  "src/editor/EditorShell.tsx"
);

assert.equal(
  root.match(/useLayerDocumentEditorOwner\(/g)
    ?.length,
  1
);
assert.match(
  shell,
  /useEditorCompositionRoot\(\)/
);
for (const connection of [
  /psdTreeProps:\s*layerDocument\.psdTreeProps/,
  /readPort:\s*layerDocument\.canvasReadPort/,
  /propertiesPanelProps:\s*layerDocument\.propertiesPanelProps/,
  /timelinePanelProps:\s*layerDocument\.timelinePanelProps/,
]) {
  assert.match(root, connection);
}
assert.doesNotMatch(
  `${root}\n${owner}`,
  /useEditorState|useProjectSourceSession|useProjectPsdEngine|useProjectSelectionModel|useProjectHistory|useTimelineEngine|usePropertiesEngine|usePsdTreeEngine|useCanvasComposition|setProjectSourceDocument|setComps|setTimelineItemsByCompId/
);
assert.match(
  owner,
  /useState\(\s*createInitialLayerDocumentOwnerOptions\s*\)/
);
assert.doesNotMatch(
  owner,
  /useEffect\([\s\S]{0,240}migrateProjectSource/
);
for (const stableRuntime of [
  /const \[resources\] = useState\(/,
  /const \[assembly\] = useState\(/,
  /const \[draftSession\] = useState\(/,
  /const \[playback\] = useState\(/,
]) {
  assert.match(owner, stableRuntime);
}
for (const nativePath of [
  /useLayerDocumentProjectOwner\(/,
  /useLayerDocumentTimelineEngine\(\{/,
  /useLayerDocumentPropertiesEngine\(\{/,
  /useLayerDocumentPsdTreeEngine\(\{/,
  /createLayerDocumentCanvasCutoverCommandPort\(\{/,
]) {
  assert.match(owner, nativePath);
}
assert.match(owner, /setDraftRevision\(/);
assert.match(owner, /applyOwnerEffect:\s*\(effect\)/);
assert.match(
  owner,
  /\(effect\.clearDraft \? 1 : 0\)/
);
assert.match(
  owner,
  /\(effect\.resetLocalUi \? 1 : 0\)/
);
assert.match(
  owner,
  /resetRevision:\s*ownerEffect\.localUiRevision/
);
assert.match(owner, /resources\.dispose\(\)/);
assert.match(owner, /playback\.dispose\(\)/);
assert.match(owner, /playback\.synchronizeClock\(\)/);
assert.match(
  root,
  /resetCanvasRuntime = useEffectEvent/
);
assert.doesNotMatch(
  root,
  /ownerEffect\.effect[\s\S]{0,40}clearDraft/
);
assert.match(
  canvas,
  /resetRevision:\s*options\.resetRevision/
);
assert.match(timeline, /pointer\.cancel|cancelPointer/);
assert.match(
  properties,
  /setRuntime\(initialRuntime\(options\.port\)\)/
);
assert.match(
  canvas,
  /buildPreviewQualityControlViewModel\(\{/
);
assert.doesNotMatch(
  canvas,
  /renderItems|inputMode/
);
assert.match(
  canvas,
  /PREVIEW_QUALITY_SCALE\[quality\]/
);

const first =
  createInitialLayerDocumentOwnerOptions();
const second =
  createInitialLayerDocumentOwnerOptions();
assert.deepEqual(first, second);
assert.deepEqual(
  validateLayerDocumentProject(first.project),
  []
);
assert.equal(
  first.activeGroupLayerDocumentId,
  first.layerSelection?.layerDocumentId
);

console.log(
  "LayerDocument Editor Root atomic cutover verification passed"
);
