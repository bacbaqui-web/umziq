import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocumentCommon,
  type LayerDocumentProject,
  type LayerDocumentTransactionResult,
  buildLayerDocumentTimelineReadModel,
} from "@/models";
import { createLayerDocumentLibrarySourceCommandAdapter } from "@/engines/library";
import { buildLayerDocumentLibraryNodes } from "@/engines/library/useLayerDocumentLibraryEngine";

const common = (parent: string | null, order: number, sourceId: string | null): LayerDocumentCommon => ({
  source: sourceId ? { sourceId } : null,
  transform: { position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 }, anchor: { x: 0, y: 0 }, scale: { x: 100, y: 100 }, scaleLinked: true, rotation: 0, opacity: 100 },
  placement: { parentLayerDocumentId: parent, order, startFrame: 0, durationFrames: 90, sourceOffsetFrames: 0, visible: true, alias: null },
  animation: { positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [], enabledProperties: { position: false, scale: false, rotation: false, opacity: false } },
  effects: [], modifiers: [],
});

let project: LayerDocumentProject = {
  metadata: { schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION, projectId: "library-audio", name: "Library Audio" },
  payload: {
    sourceRegistry: { sourcesById: {
      doc: { sourceId: "doc", kind: "psd-document", displayName: "Cut.psd", version: 1, refresh: { status: "normal" }, locator: { locatorId: "doc-locator", kind: "linked-file", suggestedFileName: "Cut.psd", relativePathHint: null }, contentFingerprint: null, data: { importSettings: { compositionName: "Cut", hiddenLayerMode: "preserve" } } },
      doc2: { sourceId: "doc2", kind: "psd-document", displayName: "Cut 2.psd", version: 1, refresh: { status: "normal" }, locator: { locatorId: "doc2-locator", kind: "linked-file", suggestedFileName: "Cut 2.psd", relativePathHint: null }, contentFingerprint: null, data: { importSettings: { compositionName: "Cut 2", hiddenLayerMode: "preserve" } } },
      shared: { sourceId: "shared", kind: "audio", displayName: "voice.wav", version: 1, refresh: { status: "normal" }, locator: { locatorId: "audio-shared", kind: "linked-file", suggestedFileName: "voice.wav", relativePathHint: null }, contentFingerprint: null, data: { mimeType: "audio/wav", durationFrames: 90, channelCount: 1, sampleRate: 48_000, provenance: "imported" } },
      recorded: { sourceId: "recorded", kind: "audio", displayName: "take", version: 1, refresh: { status: "normal" }, locator: { locatorId: "audio-recorded", kind: "linked-file", suggestedFileName: "take.wav", relativePathHint: null }, contentFingerprint: null, data: { mimeType: "audio/wav", durationFrames: 90, channelCount: 1, sampleRate: 48_000, provenance: "recorded" } },
    } },
    layerDocumentsById: {
      root: { layerDocumentId: "root", revision: 0, name: "Project", type: "group", common: common(null, 0, null), data: { role: "project-root", width: 1080, height: 1920, frameRate: 30, durationFrames: 90 } },
      cut: { layerDocumentId: "cut", revision: 0, name: "Cut", type: "group", common: common("root", 0, "doc"), data: { role: "composition", width: 1080, height: 1920, frameRate: 30, durationFrames: 90 } },
      cut2: { layerDocumentId: "cut2", revision: 0, name: "Cut 2", type: "group", common: common("root", 1, "doc2"), data: { role: "composition", width: 1080, height: 1920, frameRate: 30, durationFrames: 20 } },
      a: { layerDocumentId: "a", revision: 0, name: "Voice A", type: "audio", common: common("cut", 0, "shared"), data: { gain: 1, muted: false, fadeInFrames: 0, fadeOutFrames: 0 } },
      b: { layerDocumentId: "b", revision: 0, name: "Voice B", type: "audio", common: common("cut", 1, "shared"), data: { gain: 1, muted: false, fadeInFrames: 0, fadeOutFrames: 0 } },
      c: { layerDocumentId: "c", revision: 0, name: "Recorded", type: "audio", common: common("cut", 2, "recorded"), data: { gain: 1, muted: false, fadeInFrames: 0, fadeOutFrames: 0 } },
    },
  },
};

const controller = {
  read: () => ({ selectedSourceId: null, documents: [{ sourceId: "doc", kind: "psd-document", displayName: "Cut.psd", refreshStatus: "normal", children: [] }, { sourceId: "doc2", kind: "psd-document", displayName: "Cut 2.psd", refreshStatus: "normal", children: [] }], orphanNodes: [], nonPsdSources: [
    { sourceId: "shared", kind: "audio", displayName: "voice.wav", refreshStatus: "normal", treePolicy: "standalone" },
    { sourceId: "recorded", kind: "audio", displayName: "take.wav", refreshStatus: "normal", treePolicy: "standalone" },
  ] }),
  readProject: () => project,
  readActiveGroupLayerDocumentId: () => "cut",
} as never;
const nodes = buildLayerDocumentLibraryNodes(controller, { selectedLayerDocumentId: "b", playingLayerDocumentId: "a" });
const cut = nodes.find((node) => node.id === "doc");
assert.ok(cut);
const audio = cut.children.filter((node) => node.contentKind === "audio");
assert.deepEqual(audio.map((node) => node.id), ["a", "b", "c"]);
assert.equal(audio[0].audioProvenance, "imported");
assert.equal(audio[2].audioProvenance, "recorded");
assert.equal(audio[0].playing, true);
assert.equal(audio[1].selected, true);
assert.equal(JSON.stringify(project).includes("playing"), false, "audition state must not persist in the project");

const history: Array<Extract<LayerDocumentTransactionResult, { ok: true }>["transaction"]> = [];
let selected: string | null = null;
const commands = createLayerDocumentLibrarySourceCommandAdapter({
  readProject: () => project,
  readSelectedLayerDocumentId: () => selected,
  readActiveGroupLayerDocumentId: () => "cut",
  readSourceSelection: () => null,
  selectLayer: (id) => { selected = id; },
  selectSource: () => undefined,
  enterGroup: () => undefined,
  preparation: {} as never,
  commit: () => ({ ok: false, stage: "preparation", message: "unused" }),
  commitLayer: (result) => {
    if (!result.ok) return result;
    history.push(result.transaction);
    project = result.transaction.after;
    return result;
  },
  bridge: {} as never,
  sourceResolution: {} as never,
});

commands.selectLayerDocument("b");
assert.equal(selected, "b");
commands.toggleAudioMuted("b");
assert.equal(project.payload.layerDocumentsById.b.type === "audio" && project.payload.layerDocumentsById.b.data.muted, true);
const mute = history.at(-1)!;
project = mute.before;
assert.equal(project.payload.layerDocumentsById.b.type === "audio" && project.payload.layerDocumentsById.b.data.muted, false, "undo restores mute");
project = mute.after;
assert.equal(project.payload.layerDocumentsById.b.type === "audio" && project.payload.layerDocumentsById.b.data.muted, true, "redo restores mute");
commands.renameLayerDocument("b", "Renamed voice");
const rename = history.at(-1)!;
assert.equal(project.payload.layerDocumentsById.b.name, "Renamed voice");
project = rename.before;
assert.equal(project.payload.layerDocumentsById.b.name, "Voice B", "undo restores name");
project = rename.after;
assert.equal(project.payload.layerDocumentsById.b.name, "Renamed voice", "redo restores name");

const historyBeforeCutMove = history.length;
commands.moveLibraryLayer({ layerDocumentId: "cut2", targetLayerDocumentId: "cut", position: "before" });
assert.equal(history.length, historyBeforeCutMove + 1, "Cut drop commits one History entry");
assert.equal(project.payload.layerDocumentsById.cut2.common.placement.order, 0);
assert.equal(project.payload.layerDocumentsById.cut.common.placement.order, 1);
assert.deepEqual(
  buildLayerDocumentLibraryNodes(controller).filter((node) => node.type === "main").map((node) => node.layerDocumentId),
  ["cut2", "cut"],
  "Library Cut order follows canonical placement.order"
);
const rootTimeline = buildLayerDocumentTimelineReadModel(project, "exclude", "root");
assert.equal(rootTimeline.ok, true);
if (rootTimeline.ok) {
  assert.deepEqual(rootTimeline.model.rows.map((row) => row.layerDocumentId), ["cut2", "cut"], "Timeline and Library Cut order match");
}
assert.equal(project.payload.layerDocumentsById.a.common.placement.parentLayerDocumentId, "cut", "Cut reorder preserves children");
const cutMove = history.at(-1)!;
project = cutMove.before;
assert.equal(project.payload.layerDocumentsById.cut.common.placement.order, 0, "Cut reorder undo restores order");
project = cutMove.after;

const historyBeforeAudioMove = history.length;
commands.moveLibraryLayer({ layerDocumentId: "b", targetLayerDocumentId: "a", position: "before" });
assert.equal(history.length, historyBeforeAudioMove + 1, "same-Cut Audio reorder commits once");
assert.ok(project.payload.layerDocumentsById.b.common.placement.order < project.payload.layerDocumentsById.a.common.placement.order);
const sourceBeforeCrossMove = project.payload.layerDocumentsById.b.common.source?.sourceId;
const dataBeforeCrossMove = structuredClone(project.payload.layerDocumentsById.b.type === "audio" ? project.payload.layerDocumentsById.b.data : null);
const historyBeforeCrossMove = history.length;
commands.moveLibraryLayer({ layerDocumentId: "b", targetLayerDocumentId: "cut2", position: "inside" });
assert.equal(history.length, historyBeforeCrossMove + 1, "cross-Cut Audio move and timing clamp commit once");
assert.equal(project.payload.layerDocumentsById.b.common.placement.parentLayerDocumentId, "cut2");
assert.equal(project.payload.layerDocumentsById.b.common.placement.durationFrames, 20);
assert.equal(project.payload.layerDocumentsById.b.common.source?.sourceId, sourceBeforeCrossMove);
assert.deepEqual(project.payload.layerDocumentsById.b.type === "audio" ? project.payload.layerDocumentsById.b.data : null, dataBeforeCrossMove, "Audio domain/effect envelope survives Cut move");
const crossMove = history.at(-1)!;
project = crossMove.before;
assert.equal(project.payload.layerDocumentsById.b.common.placement.parentLayerDocumentId, "cut", "one undo restores Audio parent and timing");
project = crossMove.after;
assert.equal(project.payload.layerDocumentsById.b.common.placement.parentLayerDocumentId, "cut2", "one redo restores Audio Cut move");
const historyBeforeInvalid = history.length;
commands.moveLibraryLayer({ layerDocumentId: "missing", targetLayerDocumentId: "cut", position: "inside" });
commands.moveLibraryLayer({ layerDocumentId: "cut", targetLayerDocumentId: "cut", position: "inside" });
assert.equal(history.length, historyBeforeInvalid, "stale/self/invalid drops do not create History");

// Restore B beside A so shared-Source deletion semantics remain independently testable.
project = crossMove.before;

commands.deleteLayerDocument("a");
assert.equal(project.payload.layerDocumentsById.a, undefined);
assert.ok(project.payload.sourceRegistry.sourcesById.shared, "shared Source survives while another placement remains");
commands.deleteLayerDocument("b");
assert.equal(project.payload.layerDocumentsById.b, undefined);
assert.equal(project.payload.sourceRegistry.sourcesById.shared, undefined, "last placement deletion removes its Source");
assert.ok(project.payload.sourceRegistry.sourcesById.recorded, "unrelated Source remains");

console.log("LayerDocument Library Audio verification passed");
