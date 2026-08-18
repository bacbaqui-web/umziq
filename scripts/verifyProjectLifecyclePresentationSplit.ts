import assert from "node:assert/strict";
import {
  createProjectLifecycleBrowserDirectoryAdapter,
  type ProjectLifecycleDirectoryHandle,
} from "@/editor/project-lifecycle/adapters/projectLifecycleBrowserDirectoryAdapter";
import {
  createProjectLifecycleUiController,
} from "@/editor/project-lifecycle/controllers/projectLifecycleUiController";
import {
  sanitizeProjectName,
} from "@/editor/project-lifecycle/helpers/projectLifecycleNameHelpers";
import type {
  ProjectAssetDirectoryHandle,
} from "@/editor/projectAssetDirectoryRuntime";
import type {
  ProjectLifecycleUiCommandPort,
  ProjectLifecycleUiNotice,
  ProjectLifecycleUiViewModel,
} from "@/editor/projectLifecycleUi";

class FakeFileHandle {
  private file: File;

  constructor(file: File) {
    this.file = file;
  }

  get name() {
    return this.file.name;
  }

  async getFile() {
    return this.file;
  }

  async createWritable() {
    return {
      write: async (data: Blob | Uint8Array) => {
        const bytes = data instanceof Blob
          ? new Uint8Array(await data.arrayBuffer())
          : data;
        this.file = new File(
          [bytes],
          this.file.name
        );
      },
      close: async () => {},
      abort: async () => {},
    };
  }
}

class FakeDirectoryHandle implements
ProjectLifecycleDirectoryHandle {
  readonly directories = new Map<
    string,
    FakeDirectoryHandle
  >();
  readonly files = new Map<
    string,
    FakeFileHandle
  >();

  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  addFile(file: File) {
    this.files.set(
      file.name,
      new FakeFileHandle(file)
    );
  }

  async getDirectoryHandle(
    name: string,
    options: { readonly create: boolean }
  ) {
    const existing = this.directories.get(name);
    if (existing) return existing;
    if (!options.create) {
      throw new Error(`missing directory: ${name}`);
    }
    const directory = new FakeDirectoryHandle(name);
    this.directories.set(name, directory);
    return directory;
  }

  async getFileHandle(
    name: string,
    options: { readonly create: boolean }
  ) {
    const existing = this.files.get(name);
    if (existing) return existing;
    if (!options.create) {
      throw new Error(`missing file: ${name}`);
    }
    const handle = new FakeFileHandle(
      new File([], name)
    );
    this.files.set(name, handle);
    return handle;
  }

  async *values() {
    for (const directory of this.directories.values()) {
      yield {
        kind: "directory" as const,
        name: directory.name,
      };
    }
    for (const handle of this.files.values()) {
      yield {
        kind: "file" as const,
        name: handle.name,
        getFile: () => handle.getFile(),
      };
    }
  }
}

type Picker = (() => Promise<
  ProjectLifecycleDirectoryHandle
>) | null;

function createHarness() {
  let picker: Picker = null;
  let currentDirectory:
    ProjectAssetDirectoryHandle | null = null;
  let queued = 0;
  let cleared = 0;
  const adapter =
    createProjectLifecycleBrowserDirectoryAdapter({
      readPicker: () => picker
        ? async () => picker!()
        : undefined,
      assets: {
        read: () => currentDirectory,
        set: (directory) => {
          currentDirectory = directory;
        },
        queueOpenSelection: () => {
          queued += 1;
          return () => {
            cleared += 1;
          };
        },
      },
    });
  return {
    adapter,
    setPicker: (next: Picker) => {
      picker = next;
    },
    setCurrentDirectory: (
      directory:
        ProjectAssetDirectoryHandle | null
    ) => {
      currentDirectory = directory;
    },
    readCurrentDirectory: () => currentDirectory,
    readQueueCounts: () => ({ queued, cleared }),
  };
}

assert.equal(
  sanitizeProjectName(" Test?.ziq "),
  "Test-"
);

const directoryHarness = createHarness();
assert.equal(
  (await directoryHarness.adapter.pickDirectory())
    .status,
  "unsupported"
);
directoryHarness.setPicker(async () => {
  throw new DOMException("cancel", "AbortError");
});
assert.equal(
  (await directoryHarness.adapter.pickDirectory())
    .status,
  "cancelled"
);
directoryHarness.setPicker(async () => {
  throw new Error("permission");
});
assert.equal(
  (await directoryHarness.adapter.pickDirectory())
    .status,
  "failed"
);

const empty = new FakeDirectoryHandle("empty");
assert.deepEqual(
  await directoryHarness.adapter
    .prepareOpenProjectDirectory(empty),
  {
    status: "invalid-project-count",
    projectFileCount: 0,
  }
);
empty.addFile(new File(["one"], "one.ziq"));
const readyOpen =
  await directoryHarness.adapter
    .prepareOpenProjectDirectory(empty);
assert.equal(readyOpen.status, "ready");
if (readyOpen.status !== "ready") {
  throw new Error("Expected ready open preparation");
}
assert.deepEqual(
  [...readyOpen.selection.bytes],
  [...new TextEncoder().encode("one")]
);
const clearSelection =
  directoryHarness.adapter.queueOpenSelection(
    readyOpen.selection
  );
clearSelection();
clearSelection();
assert.deepEqual(
  directoryHarness.readQueueCounts(),
  { queued: 1, cleared: 1 }
);
empty.addFile(new File(["two"], "two.ziq"));
const multiple =
  await directoryHarness.adapter
    .prepareOpenProjectDirectory(empty);
assert.equal(
  multiple.status,
  "invalid-project-count"
);
if (multiple.status === "invalid-project-count") {
  assert.equal(multiple.projectFileCount, 2);
}

const parent = new FakeDirectoryHandle("parent");
const preparedNew =
  await directoryHarness.adapter
    .prepareNewProjectDirectory(
      parent,
      "My Project"
    );
assert.equal(preparedNew.status, "ready");
if (preparedNew.status !== "ready") {
  throw new Error("Expected ready new preparation");
}
assert.equal(
  preparedNew.request.target.fileName,
  "My Project.ziq"
);
assert.ok(
  preparedNew.directory.directories.has("psd")
);
assert.ok(
  preparedNew.directory.directories.has("audio")
);
await (
  await preparedNew.request.target.handle
    .createWritable()
).close();
assert.ok(
  preparedNew.directory.files.has("My Project.ziq")
);

const previous = new FakeDirectoryHandle("previous");
const next = new FakeDirectoryHandle("next");
directoryHarness.setCurrentDirectory(previous);
const restoredConnection =
  directoryHarness.adapter.connectProjectDirectory(next);
assert.equal(
  directoryHarness.readCurrentDirectory(),
  next
);
restoredConnection.restore();
restoredConnection.restore();
assert.equal(
  directoryHarness.readCurrentDirectory(),
  previous
);
const retainedConnection =
  directoryHarness.adapter.connectProjectDirectory(next);
retainedConnection.retain();
retainedConnection.restore();
assert.equal(
  directoryHarness.readCurrentDirectory(),
  next
);

function createViewModel():
ProjectLifecycleUiViewModel {
  return {
    projectCreated: true,
    projectLocation: "project.ziq",
    document: "file-backed",
    dirty: "clean",
    operation: "idle",
    commandsDisabled: false,
    missingSources: [],
    notice: null,
  };
}

function createCommands(options: {
  readonly createResult?: boolean;
  readonly openNotice?: ProjectLifecycleUiNotice;
}) {
  let notice: ProjectLifecycleUiNotice = null;
  const commands: ProjectLifecycleUiCommandPort = {
    read: () => ({
      ...createViewModel(),
      notice,
    }),
    newProject: async () =>
      options.createResult ?? true,
    openProject: async () => {
      notice = options.openNotice ?? {
        tone: "info",
        code: "ready",
        message: "opened",
      };
    },
    saveProject: async () => {},
    saveProjectAs: async () => {},
    closeProject: async () => {
      notice = {
        tone: "info",
        code: "close-project",
        message: "closed",
      };
    },
    reconnectSource: async () => {},
  };
  return commands;
}

const failedCreateHarness = createHarness();
failedCreateHarness.setCurrentDirectory(previous);
failedCreateHarness.setPicker(async () => parent);
const failedCreateAlerts: string[] = [];
const scheduled: (() => void)[] = [];
let exportPrepareCount = 0;
const failedCreateController =
  createProjectLifecycleUiController({
    dependencies: {
      viewModel: createViewModel(),
      commands: createCommands({
        createResult: false,
      }),
      exportOptions: {
        projectName: "Project",
        durationFrames: 300,
        frameRate: 30,
        prepare: () => {
          exportPrepareCount += 1;
        },
        run: async () => {},
      },
    },
    directory: failedCreateHarness.adapter,
    alert: (message) => {
      failedCreateAlerts.push(message);
    },
    schedule: (callback) => {
      scheduled.push(callback);
      return () => {};
    },
  });
failedCreateController.intents.startNewProject();
await failedCreateController.intents
  .chooseNewProjectLocation();
assert.equal(
  failedCreateController.read()
    .pendingProject?.parentDirectoryName,
  "parent"
);
await failedCreateController.intents
  .createNewProject("Rejected");
assert.equal(
  failedCreateController.read().creating,
  false
);
assert.notEqual(
  failedCreateController.read().pendingProject,
  null
);
assert.equal(
  failedCreateHarness.readCurrentDirectory(),
  previous,
  "Failed create must restore the previous asset directory"
);

failedCreateController.intents.openExport();
failedCreateController.intents.openExport();
assert.equal(scheduled.length, 1);
scheduled[0]!();
assert.equal(exportPrepareCount, 1);
failedCreateController.intents.closeExport();
failedCreateController.intents.openExport();
assert.equal(scheduled.length, 2);

const failedOpenHarness = createHarness();
const openDirectory = new FakeDirectoryHandle("open");
openDirectory.addFile(
  new File(["project"], "project.ziq")
);
failedOpenHarness.setCurrentDirectory(previous);
failedOpenHarness.setPicker(async () => openDirectory);
const failedOpenController =
  createProjectLifecycleUiController({
    dependencies: {
      viewModel: createViewModel(),
      commands: createCommands({
        openNotice: {
          tone: "error",
          code: "invalid-project",
          message: "failed",
        },
      }),
      exportOptions: {
        projectName: "Project",
        durationFrames: 300,
        frameRate: 30,
        prepare: () => {},
        run: async () => {},
      },
    },
    directory: failedOpenHarness.adapter,
    alert: () => {},
    schedule: () => () => {},
  });
await failedOpenController.intents.openProject();
assert.equal(
  failedOpenHarness.readCurrentDirectory(),
  previous,
  "Failed open must restore the previous asset directory"
);
assert.deepEqual(
  failedOpenHarness.readQueueCounts(),
  { queued: 1, cleared: 1 },
  "Open selection cleanup must run exactly once"
);

let pickerCalls = 0;
let releasePicker: (() => void) | null = null;
const duplicateHarness = createHarness();
duplicateHarness.setPicker(() => {
  pickerCalls += 1;
  return new Promise((resolve) => {
    releasePicker = () => resolve(openDirectory);
  });
});
const duplicateController =
  createProjectLifecycleUiController({
    dependencies: {
      viewModel: createViewModel(),
      commands: createCommands({}),
      exportOptions: {
        projectName: "Project",
        durationFrames: 300,
        frameRate: 30,
        prepare: () => {},
        run: async () => {},
      },
    },
    directory: duplicateHarness.adapter,
    alert: () => {},
    schedule: () => () => {},
  });
const firstOpen =
  duplicateController.intents.openProject();
const secondOpen =
  duplicateController.intents.openProject();
assert.equal(pickerCalls, 1);
releasePicker?.();
await Promise.all([firstOpen, secondOpen]);

let releaseStalePicker: (() => void) | null = null;
let staleOpenCalls = 0;
const staleHarness = createHarness();
staleHarness.setPicker(() =>
  new Promise((resolve) => {
    releaseStalePicker = () =>
      resolve(openDirectory);
  })
);
const staleBaseCommands = createCommands({});
const staleCommands: ProjectLifecycleUiCommandPort = {
  ...staleBaseCommands,
  openProject: async () => {
    staleOpenCalls += 1;
    await staleBaseCommands.openProject();
  },
};
const staleController =
  createProjectLifecycleUiController({
    dependencies: {
      viewModel: createViewModel(),
      commands: staleCommands,
      exportOptions: {
        projectName: "Project",
        durationFrames: 300,
        frameRate: 30,
        prepare: () => {},
        run: async () => {},
      },
    },
    directory: staleHarness.adapter,
    alert: () => {},
    schedule: () => () => {},
  });
const staleOpen =
  staleController.intents.openProject();
staleController.deactivate();
releaseStalePicker?.();
await staleOpen;
assert.equal(
  staleOpenCalls,
  0,
  "A stale picker result must not start the Core open command"
);

console.log(
  "Project lifecycle presentation split verification passed"
);
