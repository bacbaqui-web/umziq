import assert from "node:assert/strict";
import type { Psd } from "ag-psd";
import {
  createLayerDocumentSourceRuntimeResolutionStore,
  prepareLayerDocumentPsdImport,
} from "@/engines/project";

const store =
  createLayerDocumentSourceRuntimeResolutionStore();
let notificationCount = 0;
const unsubscribe = store.subscribe(() => {
  notificationCount += 1;
});

assert.deepEqual(store.read("source-a"), {
  sourceId: "source-a",
  status: "unresolved",
  permission: "unknown",
  error: null,
});

store.setResolving({
  sourceId: "source-a",
  permission: "prompt",
});
assert.equal(
  store.read("source-a").status,
  "resolving"
);
store.setAvailable({
  sourceId: "source-a",
  permission: "granted",
});
store.setMissing("source-a");
assert.deepEqual(store.read("source-a"), {
  sourceId: "source-a",
  status: "missing",
  permission: "unknown",
  error: null,
});
store.setError("source-a", "permission denied");
assert.equal(store.read("source-a").status, "error");
assert.equal(
  store.read("source-a").error,
  "permission denied"
);
assert.equal(store.remove("source-a"), true);
assert.equal(
  store.read("source-a").status,
  "unresolved"
);
assert.ok(notificationCount >= 5);
unsubscribe();

const bytes = new Uint8Array([0, 1, 2, 3]);
const sourceBuffer = bytes.buffer;
let arrayBufferReadCount = 0;
let parsedBuffer: ArrayBuffer | null = null;
const importFile = {
  name: "single-read.psd",
  size: bytes.byteLength,
  type: "image/vnd.adobe.photoshop",
  lastModified: 0,
  arrayBuffer: async () => {
    arrayBufferReadCount += 1;
    return sourceBuffer;
  },
} as File;
const prepared = await prepareLayerDocumentPsdImport({
  file: importFile,
  token: "single-read",
  parentLayerDocumentId: "root",
  order: 0,
  durationFrames: 30,
  parsePsd: (buffer) => {
    parsedBuffer = buffer;
    return {
      width: 100,
      height: 200,
      children: [],
    } as Psd;
  },
});

assert.equal(arrayBufferReadCount, 1);
assert.equal(parsedBuffer, sourceBuffer);
assert.equal(prepared.resolution.file, importFile);
assert.deepEqual(prepared.resolution.sourceIds, [
  prepared.resolution.documentSourceId,
]);
const documentSource = prepared.command.sources[0];
assert.equal(documentSource.kind, "psd-document");
if (documentSource.kind !== "psd-document") {
  throw new Error("Expected PSD document descriptor");
}
assert.deepEqual(documentSource.contentFingerprint, {
  algorithm: "sha-256",
  digestHex:
    "054edec1d0211f624fed0cbca9d4f9400b0e491c43742af2c5b0abebf0c990d8",
  byteLength: 4,
});
assert.equal(
  JSON.stringify(prepared.command).includes(
    "\"arrayBuffer\""
  ),
  false,
  "Persistent commands must not contain runtime File objects"
);
prepared.runtime.cancel();

console.log(
  "Layer Document Source runtime resolution verification passed"
);
