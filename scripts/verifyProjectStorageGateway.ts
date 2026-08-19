import assert from "node:assert/strict";
import {
  createFakeProjectStorageGateway,
} from "@/gateway";
import {
  loadLayerDocumentProjectFromZiq,
  saveLayerDocumentProjectToZiq,
} from "@/engines/project";
import {
  createInitialLayerDocumentNexusOptions,
} from "@/editor/layerDocumentEditorBootstrap";

const project = createInitialLayerDocumentNexusOptions().project;
const encoded = saveLayerDocumentProjectToZiq(project);
assert.equal(encoded.ok, true);
if (!encoded.ok) throw new Error(encoded.error.message);

const fake = createFakeProjectStorageGateway({
  reads: [{
    fileName: "project.ziq",
    bytes: encoded.value,
    target: null,
  }],
});
const read = await fake.gateway.chooseProject();
assert.equal(read.ok, true);
if (!read.ok) throw new Error(read.error.message);
const loaded = loadLayerDocumentProjectFromZiq(read.value.bytes);
assert.equal(loaded.ok, true);
if (!loaded.ok) throw new Error(loaded.error.message);

const target = await fake.gateway.chooseTarget("project.ziq");
assert.equal(target.ok, true);
if (!target.ok) throw new Error(target.error.message);
const reencoded = saveLayerDocumentProjectToZiq(loaded.value.project);
assert.equal(reencoded.ok, true);
if (!reencoded.ok) throw new Error(reencoded.error.message);
assert.deepEqual(reencoded.value, encoded.value);
assert.equal(
  (await fake.gateway.write({
    target: target.value,
    bytes: reencoded.value,
    shouldCommit: () => true,
  })).ok,
  true
);
assert.deepEqual(fake.writes[0]?.bytes, encoded.value);

const stale = await fake.gateway.write({
  target: target.value,
  bytes: encoded.value,
  shouldCommit: () => false,
});
assert.equal(stale.ok, false);
if (!stale.ok) assert.equal(stale.error.code, "stale-write");
assert.equal(fake.writes.length, 1);

console.log("Project Storage Gateway verification passed");
