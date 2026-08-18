import assert from "node:assert/strict";
import {
  copyFilesIntoProjectAssets,
  findLinkedSourceInProjectAssets,
  queueProjectOpenSelection,
  setProjectAssetDirectory,
  takeProjectOpenSelection,
  type ProjectAssetDirectoryHandle,
} from "@/editor/projectAssetDirectoryRuntime";

const originalWindow = globalThis.window;
const source = new File(["audio"], "voice.wav", { type: "audio/wav" });

const projectOpenSelection = {
  file: new File(["project"], "project.ziq"),
  bytes: new Uint8Array([1, 2, 3]),
  handle: null,
};
const clearProjectOpenSelection =
  queueProjectOpenSelection(projectOpenSelection);
assert.strictEqual(
  takeProjectOpenSelection(),
  projectOpenSelection
);
assert.equal(takeProjectOpenSelection(), null);
clearProjectOpenSelection();

globalThis.window = {} as never;
const linked = await copyFilesIntoProjectAssets({ files: [source], kind: "audio", copy: false });
assert.equal(linked[0].file, source);
assert.equal(linked[0].relativePathHint, null);

let written: Blob | Uint8Array | null = null;
const copiedFile = new File(["copied"], "voice.wav", { type: "audio/wav" });
const audioDirectory: ProjectAssetDirectoryHandle = {
  name: "audio",
  getDirectoryHandle: async () => audioDirectory,
  getFileHandle: async (name, options) => {
    if (!options.create) throw new Error("missing");
    return {
    name,
    getFile: async () => copiedFile,
    createWritable: async () => ({
      write: async (data) => { written = data; },
      close: async () => undefined,
    }),
  }},
};
const projectDirectory: ProjectAssetDirectoryHandle = {
  name: "project",
  getDirectoryHandle: async (name) => {
    assert.equal(name, "audio");
    return audioDirectory;
  },
  getFileHandle: async () => { throw new Error("unexpected root write"); },
};
setProjectAssetDirectory(projectDirectory);
globalThis.window = {} as never;
const copied = await copyFilesIntoProjectAssets({ files: [source], kind: "audio", copy: true });
assert.equal(written, source);
assert.equal(copied[0].file, copiedFile);
assert.equal(copied[0].relativePathHint, "audio/voice.wav");

let collisionWriteName: string | null = null;
const collisionDirectory: ProjectAssetDirectoryHandle = {
  name: "audio",
  getDirectoryHandle: async () => collisionDirectory,
  getFileHandle: async (name, options) => {
    if (!options.create && name === "voice.wav") {
      return {
        name,
        getFile: async () => copiedFile,
        createWritable: async () => { throw new Error("unexpected overwrite"); },
      };
    }
    if (!options.create) throw new Error("missing");
    collisionWriteName = name;
    return {
      name,
      getFile: async () => new File(["copy"], name),
      createWritable: async () => ({
        write: async () => undefined,
        close: async () => undefined,
      }),
    };
  },
};
setProjectAssetDirectory({
  name: "project",
  getDirectoryHandle: async () => collisionDirectory,
  getFileHandle: async () => { throw new Error("unexpected root write"); },
});
const collisionCopy = await copyFilesIntoProjectAssets({
  files: [source],
  kind: "audio",
  copy: true,
});
assert.equal(collisionWriteName, "voice (2).wav");
assert.equal(collisionCopy[0].relativePathHint, "audio/voice (2).wav");

let failedWriteCleanup: string | null = null;
const failedWriteDirectory: ProjectAssetDirectoryHandle = {
  name: "audio",
  getDirectoryHandle: async () => failedWriteDirectory,
  getFileHandle: async (name, options) => {
    if (!options.create) throw new Error("missing");
    return {
      name,
      getFile: async () => new File([], name),
      createWritable: async () => ({
        write: async () => { throw new Error("write failed"); },
        close: async () => undefined,
        abort: async () => undefined,
      }),
    };
  },
  removeEntry: async (name) => { failedWriteCleanup = name; },
};
setProjectAssetDirectory({
  name: "project",
  getDirectoryHandle: async () => failedWriteDirectory,
  getFileHandle: async () => { throw new Error("unexpected root write"); },
});
await assert.rejects(
  copyFilesIntoProjectAssets({ files: [source], kind: "audio", copy: true }),
  /write failed/
);
assert.equal(failedWriteCleanup, "voice.wav");

const digestHex = async (file: File) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
const expectedPsd = new File(["expected-psd"], "renamed.psd");
const wrongPsd = new File(["wrong-psd"], "shot.psd");
const psdHandles = new Map([
  ["shot.psd", wrongPsd],
  ["renamed.psd", expectedPsd],
]);
const psdDirectory: ProjectAssetDirectoryHandle = {
  name: "psd",
  getDirectoryHandle: async () => psdDirectory,
  getFileHandle: async (name) => {
    const file = psdHandles.get(name);
    if (!file) throw new Error("missing");
    return {
      name,
      getFile: async () => file,
      createWritable: async () => { throw new Error("unexpected write"); },
    };
  },
  values: async function* () {
    for (const [name, file] of psdHandles) {
      yield { kind: "file" as const, name, getFile: async () => file };
    }
  },
};
setProjectAssetDirectory({
  name: "project",
  getDirectoryHandle: async (name) => {
    if (name === "psd") return psdDirectory;
    if (name === "audio") return audioDirectory;
    throw new Error("missing directory");
  },
  getFileHandle: async () => { throw new Error("unexpected root read"); },
});
const recoveredByFingerprint = await findLinkedSourceInProjectAssets({
  kind: "psd-document",
  suggestedFileName: "shot.psd",
  relativePathHint: "psd/shot.psd",
  contentFingerprint: {
    digestHex: await digestHex(expectedPsd),
    byteLength: expectedPsd.size,
  },
});
assert.equal(recoveredByFingerprint?.file.name, "renamed.psd");
const missingPsd = await findLinkedSourceInProjectAssets({
  kind: "psd-document",
  suggestedFileName: "absent.psd",
  relativePathHint: "psd/absent.psd",
  contentFingerprint: {
    digestHex: "00",
    byteLength: 999,
  },
});
assert.equal(missingPsd, null);

setProjectAssetDirectory(null);
globalThis.window = originalWindow;
console.log("Project asset directory runtime verification passed");
