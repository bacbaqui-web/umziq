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
const runtime = source(
  "src/editor/useLayerDocumentEditorRuntime.ts"
);
const panelPorts = source(
  "src/editor/useLayerDocumentPanelEnginePorts.ts"
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
const projectOwner = source(
  "src/editor/project-owner/useEditorProjectOwner.ts"
);
const timelinePlayback = source(
  "src/engines/timeline/adapters/layerDocumentTimelinePlaybackAdapter.ts"
);
const ownerModel = source(
  "src/engines/project/models/layerDocumentProjectOwnerModel.ts"
);
const ownerReducer = source(
  "src/engines/project/actions/layerDocumentProjectOwnerReducer.ts"
);
const canvasCommands = source(
  "src/engines/canvas/adapters/layerDocumentCanvasCommandPortAdapter.ts"
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
  /psdTreeProps:\s*psdTree\.viewProps/,
  /readPort:\s*panelPorts\.canvasRead/,
  /propertiesPanelProps:\s*properties\.viewProps/,
  /timelinePanelProps:\s*timeline\.viewProps/,
]) {
  assert.match(root, connection);
}
assert.doesNotMatch(
  `${root}\n${owner}\n${runtime}\n${panelPorts}`,
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
  /const \[ownerCommands\] = useState\(/,
  /const \[draftSession\] = useState<[\s\S]{0,80}>\(/,
  /const \[playback\] = useState\(/,
]) {
  assert.match(runtime, stableRuntime);
}
assert.match(owner, /useEditorProjectOwner\(/);
assert.equal(
  owner.match(/useEditorProjectOwner\(/g)?.length,
  1
);
assert.doesNotMatch(
  owner,
  /useLayerDocument(?:Timeline|Properties|PsdTree|Canvas)|createLayerDocumentTimelinePlaybackRuntime/
);
for (const nativePath of [
  /useLayerDocumentTimelineEngine\(\{/,
  /useLayerDocumentPropertiesEngine\(\{/,
  /useLayerDocumentPsdTreeEngine\(\{/,
  /useLayerDocumentCanvasComposition\(\{/,
]) {
  assert.match(root, nativePath);
  assert.equal(
    Array.from(
      root.matchAll(
        new RegExp(nativePath.source, "g")
      )
    ).length,
    1
  );
}
for (const panelPort of [
  /createLayerDocumentCanvasCommandPort\(\{/,
  /createLayerDocumentPropertiesCommandPort\(\{/,
  /createLayerDocumentPsdTreeController\(\{/,
]) {
  assert.match(panelPorts, panelPort);
}
for (const rootBoundary of [
  /useEditorProjectOwner\(/,
  /useLayerDocumentEditorRuntime\(/,
  /useLayerDocumentPanelEnginePorts\(\{/,
]) {
  assert.match(`${owner}\n${root}`, rootBoundary);
}
assert.doesNotMatch(owner, /useLayerDocumentProjectOwner\(/);
assert.doesNotMatch(
  runtime,
  /createLayerDocumentProjectOwnerCompatibilityPort/
);
assert.match(
  projectOwner,
  /createEditorProjectOwnerPort\(\s*initialState,\s*reduceLayerDocumentProjectOwner/
);
assert.match(runtime, /setDraftRevision\(/);
assert.match(runtime, /applyOwnerEffect,/);
assert.match(
  runtime,
  /\(effect\.clearDraft \? 1 : 0\)/
);
assert.match(
  runtime,
  /\(effect\.resetLocalUi \? 1 : 0\)/
);
assert.match(
  root,
  /resetRevision:\s*runtime\.ownerEffect\.localUiRevision/
);
assert.match(runtime, /resources\.dispose\(\)/);
assert.match(runtime, /playback\.dispose\(\)/);
assert.match(runtime, /playback\.synchronizeClock\(\)/);
assert.match(
  runtime,
  /timelineValidity\.reconcile\(\)/
);
assert.match(
  runtime,
  /resourceDisposeTimer[\s\S]*window\.setTimeout[\s\S]*resources\.dispose\(\)/
);
assert.match(
  runtime,
  /playbackDisposeTimer[\s\S]*window\.setTimeout[\s\S]*playback\.dispose\(\)/
);
assert.match(
  runtime,
  /createEditorProjectOwnerCommandAdapter\(\{[\s\S]*draftSession\.clear,[\s\S]*applyOwnerEffect/
);
assert.match(
  panelPorts,
  /readDraft:\s*draftSession\.read/
);
assert.match(
  root,
  /playback:\s*runtime\.playback/
);
assert.match(
  root,
  /frameInput:\s*runtime\.playback/
);
assert.match(
  panelPorts,
  /readGlobalFrame:\s*\(\)\s*=>\s*frameInput\.read\(\)\.currentFrame/
);
assert.match(
  panelPorts,
  /globalFrame:\s*frameInput\.read\(\)\.currentFrame/
);
assert.match(
  panelPorts,
  /createLayerDocumentCanvasCommandPort\(\{[\s\S]*playback:\s*frameInput/
);
assert.doesNotMatch(
  panelPorts,
  /ports\.playback\.read\(\)\.currentFrame/
);
assert.doesNotMatch(
  root,
  /currentFrame|useState\([^)]*frame|useRef\([^)]*frame|createLayerDocumentTimelinePlaybackRuntime/
);
for (const authority of [
  /let currentFrame = 0/,
  /let range = normalizePlaybackRange/,
  /let isPlaying = false/,
  /commands:\s*\{[\s\S]*play,[\s\S]*pause,[\s\S]*seek:/,
  /validity:\s*\{\s*reconcile\s*\}/,
]) {
  assert.match(timelinePlayback, authority);
}
assert.match(
  timeline,
  /const playback = useSyncExternalStore\([\s\S]*options\.playback\.subscribe,[\s\S]*options\.playback\.read/
);
assert.doesNotMatch(
  `${ownerModel}\n${ownerReducer}`,
  /set-playback-session|session\.playback|ports\.playback|readonly playback:/
);
assert.match(
  canvasCommands,
  /seekFrame:\s*\(globalFrame\)[\s\S]*playback\.commands\.seek\(globalFrame\)/
);
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
  "LayerDocument Editor Root verification passed"
);
