import assert from "node:assert/strict";
import {
  buildSetLayerDocumentNameTransaction,
} from "@/models";
import {
  createLayerDocumentProjectLifecycleController,
  createLayerDocumentNexusState,
  createLayerDocumentProjectSaveController,
  loadLayerDocumentProjectFromZiq,
  reduceLayerDocumentNexus,
  type LayerDocumentProjectBrowserWriteEnvironment,
  type LayerDocumentNexusAction,
  type LayerDocumentNexusState,
  type LayerDocumentProjectWritableFileHandle,
} from "@/engines/project";
import { createLayerDocumentProjectBrowserWriteAdapter } from "@/gateway";
import {
  createInitialLayerDocumentNexusOptions,
} from "@/editor/layerDocumentEditorBootstrap";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

interface WriteBehavior {
  readonly started?: {
    resolve: () => void;
  };
  readonly gate?: Promise<void>;
  readonly createError?: unknown;
  readonly writeError?: unknown;
  readonly closeError?: unknown;
}

function createHandle(name: string) {
  const behaviors: WriteBehavior[] = [];
  const committed: Uint8Array[] = [];
  let abortCount = 0;
  const handle:
    LayerDocumentProjectWritableFileHandle = {
      name,
      createWritable: async () => {
        const behavior = behaviors.shift() ?? {};
        if (behavior.createError) {
          throw behavior.createError;
        }
        let pending: Uint8Array | null = null;
        return {
          write: async (bytes) => {
            behavior.started?.resolve();
            pending = bytes.slice();
            await behavior.gate;
            if (behavior.writeError) {
              throw behavior.writeError;
            }
          },
          close: async () => {
            if (behavior.closeError) {
              throw behavior.closeError;
            }
            if (pending) committed.push(pending);
          },
          abort: async () => {
            abortCount += 1;
            pending = null;
          },
        };
      },
    };
  return {
    handle,
    behaviors,
    committed,
    readAbortCount: () => abortCount,
  };
}

function createNexusFixture() {
  const initial =
    createInitialLayerDocumentNexusOptions();
  const initialized =
    createLayerDocumentNexusState(initial);
  assert.equal(initialized.ok, true);
  if (!initialized.ok) {
    throw new Error(initialized.error.message);
  }
  const stateRef: {
    current: LayerDocumentNexusState;
  } = { current: initialized.state };
  const nexus = {
    get state() {
      return stateRef.current;
    },
    transition: (
      action: LayerDocumentNexusAction
    ) => {
      const result =
        reduceLayerDocumentNexus(
          stateRef.current,
          action
        );
      if (result.ok && result.changed) {
        stateRef.current = result.state;
      }
      return result;
    },
  };
  const lifecycle =
    createLayerDocumentProjectLifecycleController({
      nexus,
      runtime: {
        clearDraft: () => {},
        resetLocalUi: () => {},
        stopPlayback: () => {},
        invalidateSourceRuntime: () => 0,
        resetSourceResolution: () => {},
      },
    });
  const rename = (name: string) => {
    const result =
      buildSetLayerDocumentNameTransaction(
        nexus.state.currentProject,
        {
          layerDocumentId:
            initial.activeGroupLayerDocumentId!,
          name,
        }
      );
    assert.equal(result.ok, true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    const committed = nexus.transition({
      kind: "commit-layer-transaction",
      transaction: result.transaction,
    });
    assert.equal(committed.ok, true);
  };
  return { nexus, lifecycle, rename };
}

function pickerError(name: string) {
  return new DOMException(name, name);
}

const firstHandle = createHandle(
  "native-initial.ziq"
);
const saveAsHandle = createHandle(
  "native-save-as.ziq"
);
const deniedHandle = createHandle(
  "native-denied.ziq"
);
deniedHandle.behaviors.push({
  createError: pickerError("NotAllowedError"),
});
const pickerQueue: Array<
  LayerDocumentProjectWritableFileHandle | Error
> = [
  firstHandle.handle,
];
let pickerCount = 0;
const unusedDownloads: Blob[] = [];
const nativeEnvironment:
  LayerDocumentProjectBrowserWriteEnvironment = {
    showSaveFilePicker: async () => {
      pickerCount += 1;
      const next = pickerQueue.shift();
      if (next instanceof Error) throw next;
      if (!next) throw new Error("Missing picker fixture");
      return next;
    },
    createObjectURL: (blob) => {
      unusedDownloads.push(blob);
      return "blob:unused";
    },
    revokeObjectURL: () => {},
    createDownloadAnchor: () => ({
      href: "",
      download: "",
      click: () => {},
    }),
  };
const nativeBrowser =
  createLayerDocumentProjectBrowserWriteAdapter(
    nativeEnvironment
  );
assert.equal(
  nativeBrowser.capability,
  "native-file-system"
);
const nativeFixture = createNexusFixture();
const nativeSave =
  createLayerDocumentProjectSaveController({
    readProject: () =>
      nativeFixture.nexus.state.currentProject,
    lifecycle: nativeFixture.lifecycle,
    storage: nativeBrowser,
  });

const firstSave = await nativeSave.save();
assert.equal(firstSave.ok, true);
assert.equal(pickerCount, 1);
assert.strictEqual(
  nativeSave.readTarget()?.kind ===
    "native-file-system"
    ? nativeSave.readTarget()?.handle
    : null,
  firstHandle.handle
);
assert.equal(firstHandle.committed.length, 1);
assert.equal(nativeFixture.lifecycle.read().dirty, "clean");
assert.equal(
  nativeFixture.lifecycle.read().document,
  "file-backed"
);
const firstLoaded =
  loadLayerDocumentProjectFromZiq(
    firstHandle.committed[0]
  );
assert.equal(firstLoaded.ok, true);

nativeFixture.rename("Snapshot Being Saved");
const midSaveStarted = deferred();
const midSaveGate = deferred();
firstHandle.behaviors.push({
  started: midSaveStarted,
  gate: midSaveGate.promise,
});
const midSave = nativeSave.save();
await midSaveStarted.promise;
nativeFixture.rename("Edited During Save");
midSaveGate.resolve();
assert.equal((await midSave).ok, true);
assert.equal(
  nativeFixture.lifecycle.read().dirty,
  "dirty",
  "A newer edit must remain dirty after an older snapshot saves"
);
assert.equal(pickerCount, 1);

const stableTarget = nativeSave.readTarget();
const savepointBeforeFailure =
  nativeFixture.lifecycle.read().savepointDigest;
firstHandle.behaviors.push({
  writeError: new Error("disk full"),
});
const failedWrite = await nativeSave.save();
assert.equal(failedWrite.ok, false);
if (!failedWrite.ok) {
  assert.equal(
    failedWrite.error.code,
    "write-failed"
  );
}
assert.strictEqual(
  nativeSave.readTarget(),
  stableTarget
);
assert.equal(
  nativeFixture.lifecycle.read().savepointDigest,
  savepointBeforeFailure
);
assert.equal(nativeFixture.lifecycle.read().dirty, "dirty");

pickerQueue.push(pickerError("AbortError"));
const cancelledSaveAs = await nativeSave.saveAs();
assert.equal(cancelledSaveAs.ok, false);
if (!cancelledSaveAs.ok) {
  assert.equal(
    cancelledSaveAs.error.code,
    "cancelled"
  );
}
assert.strictEqual(
  nativeSave.readTarget(),
  stableTarget
);

pickerQueue.push(deniedHandle.handle);
const deniedSaveAs = await nativeSave.saveAs();
assert.equal(deniedSaveAs.ok, false);
if (!deniedSaveAs.ok) {
  assert.equal(
    deniedSaveAs.error.code,
    "permission-denied"
  );
}
assert.strictEqual(
  nativeSave.readTarget(),
  stableTarget
);

pickerQueue.push(saveAsHandle.handle);
const successfulSaveAs =
  await nativeSave.saveAs();
assert.equal(successfulSaveAs.ok, true);
const saveAsTarget = nativeSave.readTarget();
assert.equal(saveAsTarget?.kind, "native-file-system");
if (saveAsTarget?.kind === "native-file-system") {
  assert.strictEqual(
    saveAsTarget.handle,
    saveAsHandle.handle
  );
}
assert.equal(nativeFixture.lifecycle.read().dirty, "clean");

nativeFixture.rename("Older Concurrent Save");
const staleStarted = deferred();
const staleGate = deferred();
saveAsHandle.behaviors.push(
  {
    started: staleStarted,
    gate: staleGate.promise,
  },
  {}
);
const staleSave = nativeSave.save();
await staleStarted.promise;
nativeFixture.rename("Latest Concurrent Save");
const latestSave = nativeSave.save();
staleGate.resolve();
const staleCompletion = await staleSave;
assert.equal((await latestSave).ok, true);
assert.equal(staleCompletion.ok, false);
if (!staleCompletion.ok) {
  assert.equal(
    staleCompletion.error.code,
    "stale-operation"
  );
}
assert.equal(saveAsHandle.readAbortCount(), 1);
assert.equal(nativeFixture.lifecycle.read().dirty, "clean");
const latestBytes =
  saveAsHandle.committed[
    saveAsHandle.committed.length - 1
  ];
const latestLoaded =
  loadLayerDocumentProjectFromZiq(latestBytes);
assert.equal(latestLoaded.ok, true);
if (latestLoaded.ok) {
  const root = Object.values(
    latestLoaded.value.project.payload
      .layerDocumentsById
  ).find((layer) => layer.type === "group");
  assert.equal(root?.name, "Latest Concurrent Save");
}
const serializedNexus =
  JSON.stringify(nativeFixture.nexus.state);
assert.equal(
  serializedNexus.includes("native-save-as.ziq"),
  false,
  "File handles must remain outside Project, History, and Session"
);
const envelope = JSON.parse(
  new TextDecoder().decode(latestBytes)
) as Record<string, unknown>;
assert.deepEqual(
  Object.keys(envelope).sort(),
  ["containerVersion", "format", "project"]
);
assert.equal("history" in envelope, false);
assert.equal("session" in envelope, false);
assert.equal("runtime" in envelope, false);

const fallbackFixture = createNexusFixture();
const downloaded: Blob[] = [];
const anchors: Array<{
  href: string;
  download: string;
  clicked: boolean;
  removed: boolean;
}> = [];
const revoked: string[] = [];
const fallbackBrowser =
  createLayerDocumentProjectBrowserWriteAdapter({
    createObjectURL: (blob) => {
      downloaded.push(blob);
      return `blob:fallback-${downloaded.length}`;
    },
    revokeObjectURL: (url) => {
      revoked.push(url);
    },
    createDownloadAnchor: () => {
      const record = {
        href: "",
        download: "",
        clicked: false,
        removed: false,
      };
      anchors.push(record);
      return {
        get href() {
          return record.href;
        },
        set href(value) {
          record.href = value;
        },
        get download() {
          return record.download;
        },
        set download(value) {
          record.download = value;
        },
        click: () => {
          record.clicked = true;
        },
        remove: () => {
          record.removed = true;
        },
      };
    },
  });
assert.equal(
  fallbackBrowser.capability,
  "blob-download"
);
const fallbackSave =
  createLayerDocumentProjectSaveController({
    readProject: () =>
      fallbackFixture.nexus.state.currentProject,
    lifecycle: fallbackFixture.lifecycle,
    storage: fallbackBrowser,
  });
const fallbackResult = await fallbackSave.save();
assert.equal(fallbackResult.ok, true);
assert.equal(fallbackSave.readTarget(), null);
assert.equal(downloaded.length, 1);
assert.equal(
  downloaded[0].type,
  "application/json;charset=utf-8"
);
assert.equal(anchors[0].clicked, true);
assert.equal(anchors[0].removed, true);
assert.ok(anchors[0].download.endsWith(".ziq"));
assert.deepEqual(revoked, ["blob:fallback-1"]);
fallbackFixture.rename("Fallback Again");
assert.equal((await fallbackSave.save()).ok, true);
assert.equal(
  downloaded.length,
  2,
  "Fallback Save must download again because it has no retained handle"
);
assert.equal(fallbackSave.readTarget(), null);

console.log(
  "Layer Document Project Save verification passed"
);
