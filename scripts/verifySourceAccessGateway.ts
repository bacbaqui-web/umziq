import assert from "node:assert/strict";
import {
  createFakeSourceAccessGateway,
  type SourceResourceReference,
} from "@/gateway";

const source: SourceResourceReference = {
  resourceId: "source:one",
  fileName: "voice.wav",
  mimeType: "audio/wav",
  byteLength: 3,
  relativePathHint: null,
};
const gateway = createFakeSourceAccessGateway(
  new Map([[source.resourceId, new Uint8Array([1, 2, 3])]])
);
const first = await gateway.readSource(source);
assert.equal(first.ok, true);
if (!first.ok) throw new Error(first.error.message);
assert.deepEqual([...first.value], [1, 2, 3]);
const copied = await gateway.copyIntoProjectAssets({
  sources: [source],
  kind: "audio",
  copy: true,
});
assert.equal(copied.ok, true);
if (!copied.ok) throw new Error(copied.error.message);
assert.equal(copied.value[0]?.relativePathHint, "voice.wav");
gateway.release([source]);
assert.equal((await gateway.readSource(source)).ok, false);

console.log("Source Access Gateway verification passed");
