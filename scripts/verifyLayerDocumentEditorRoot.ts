import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateLayerDocumentProject,
} from "@/models";
import {
  createInitialLayerDocumentNexusOptions,
} from "@/editor/layerDocumentEditorBootstrap";

const source = (path: string) =>
  readFileSync(path, "utf8");
const root = source(
  "src/editor/useEditorRoot.ts"
);
const nexus = source(
  "src/editor/useLayerDocumentEditorNexus.ts"
);
const runtime = source(
  "src/editor/useLayerDocumentEditorRuntime.ts"
);
const panelPorts = source(
  "src/editor/useLayerDocumentPanelEnginePorts.ts"
);
const canvas = source(
  "src/engines/canvas/useLayerDocumentCanvasEngine.ts"
);
const timeline = source(
  "src/engines/timeline/useLayerDocumentTimelineEngine.ts"
);
const properties = source(
  "src/engines/visual/useLayerDocumentVisualEngine.ts"
);
const propertiesComposer = source(
  "src/engines/visual/composers/useLayerDocumentPropertiesComposer.ts"
);
const propertiesDraftController = source(
  "src/engines/visual/controllers/propertiesNumericDraftController.ts"
);
const shell = source(
  "src/editor/EditorShell.tsx"
);
const nexusImplementation = source(
  "src/editor/nexus/useEditorNexus.ts"
);
const timelinePlayback = source(
  "src/engines/timeline/state/layerDocumentTimelinePlaybackRuntime.ts"
);
const nexusModel = source(
  "src/engines/project/models/layerDocumentNexusModel.ts"
);
const nexusReducer = source(
  "src/engines/project/actions/layerDocumentNexusReducer.ts"
);
const canvasCommands = source(
  "src/engines/canvas/adapters/layerDocumentCanvasCommandPortAdapter.ts"
);

assert.equal(
  root.match(/useLayerDocumentEditorNexus\(/g)
    ?.length,
  1
);
assert.match(
  shell,
  /useEditorRoot\(\)/
);
for (const connection of [
  /libraryProps:\s*{[\s\S]{0,120}\.\.\.library\.viewProps,[\s\S]{0,120}registerSourceFiles:\s*sourceAccess\.registerFiles/,
  /readPort:\s*panelPorts\.canvasRead/,
  /visualPanelProps:\s*visual\.viewProps/,
  /timelinePanelProps:\s*timeline\.viewProps/,
]) {
  assert.match(root, connection);
}
assert.doesNotMatch(
  `${root}\n${nexus}\n${runtime}\n${panelPorts}`,
  /useEditorState|useProjectSourceSession|useProjectPsdEngine|useProjectSelectionModel|useProjectHistory|useTimelineEngine|usePropertiesEngine|useLibraryEngine|useCanvasComposition|setProjectSourceDocument|setComps|setTimelineItemsByCompId/
);
assert.match(
  nexus,
  /useState\(\s*createInitialLayerDocumentNexusOptions\s*\)/
);
assert.doesNotMatch(
  nexus,
  /useEffect\([\s\S]{0,240}migrateProjectSource/
);
for (const stableRuntime of [
  /const \[resources\] = useState\(/,
  /const \[nexusCommands\] = useState\(/,
  /const \[draftSession\] = useState<[\s\S]{0,80}>\(/,
  /const \[playback\] = useState\(/,
]) {
  assert.match(runtime, stableRuntime);
}
assert.match(nexus, /useEditorNexus\(/);
assert.equal(
  nexus.match(/useEditorNexus\(/g)?.length,
  1
);
assert.doesNotMatch(
  nexus,
  /useLayerDocument(?:Timeline|Properties|Library|Canvas)|createLayerDocumentTimelinePlaybackRuntime/
);
for (const nativePath of [
  /useLayerDocumentTimelineEngine\(\{/,
  /useLayerDocumentVisualEngine\(\{/,
  /useLayerDocumentLibraryEngine\(\{/,
  /useLayerDocumentCanvasEngine\(\{/,
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
  /createLayerDocumentLibraryController\(\{/,
]) {
  assert.match(panelPorts, panelPort);
}
for (const rootBoundary of [
  /useEditorNexus\(/,
  /useLayerDocumentEditorRuntime\(/,
  /useLayerDocumentPanelEnginePorts\(\{/,
]) {
  assert.match(`${nexus}\n${root}`, rootBoundary);
}
assert.doesNotMatch(nexus, /useLayerDocumentNexus\(/);
assert.doesNotMatch(
  runtime,
  /createLayerDocumentNexusCompatibilityPort/
);
assert.match(
  nexusImplementation,
  /createEditorNexusPort\(\s*initialState,\s*reduceLayerDocumentNexus/
);
assert.match(runtime, /setDraftRevision\(/);
assert.match(runtime, /applyNexusEffect,/);
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
  /resetRevision:\s*runtime\.nexusEffect\.localUiRevision/
);
assert.match(runtime, /resources\.dispose\(\)/);
assert.match(runtime, /audio\.dispose\(\)/);
assert.match(runtime, /playback\.dispose\(\)/);
assert.match(runtime, /playback\.synchronizeClock\(\)/);
assert.match(
  runtime,
  /playback\.subscribe\(synchronizeAudio\)/
);
assert.match(
  runtime,
  /audio\.synchronizeTimeline\(\{[\s\S]*currentFrame:[\s\S]*isPlaying:/
);
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
  /audioDisposeTimer[\s\S]*window\.clearTimeout[\s\S]*window\.setTimeout[\s\S]*audio\.dispose\(\)/
);
assert.doesNotMatch(
  runtime,
  /useEffect\(\(\) => \(\) => audio\.dispose\(\)/
);
assert.match(
  runtime,
  /playbackDisposeTimer[\s\S]*window\.setTimeout[\s\S]*playback\.dispose\(\)/
);
assert.match(
  runtime,
  /createEditorNexusCommandAdapter\(\{[\s\S]*draftSession\.clear,[\s\S]*applyNexusEffect/
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
  `${nexusModel}\n${nexusReducer}`,
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
  /nexusEffect\.effect[\s\S]{0,40}clearDraft/
);
assert.match(
  canvas,
  /resetRevision:\s*options\.resetRevision/
);
assert.match(timeline, /pointer\.cancel|cancelPointer/);
assert.match(
  properties,
  /return useLayerDocumentPropertiesComposer\(options\)/
);
assert.match(
  propertiesComposer,
  /usePropertiesNumericDraftController\(scopeIdentity\)/
);
assert.match(
  propertiesDraftController,
  /controller\.syncScope\(scopeIdentity\)/
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
  /PREVIEW_QUALITY_SCALE\[previewQuality\]/
);
assert.match(
  canvas,
  /mapCanvasPreviewQualityToSourceSamplingQuality\(\s*previewQuality\s*\)/
);

const first =
  createInitialLayerDocumentNexusOptions();
const second =
  createInitialLayerDocumentNexusOptions();
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
