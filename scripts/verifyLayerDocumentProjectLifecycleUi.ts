import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  createProjectLifecycleUiCommandPort,
} from "@/editor/projectLifecycleUi";
import {
  createInitialLayerDocumentOwnerOptions,
} from "@/editor/layerDocumentEditorBootstrap";
import {
  buildLayerDocumentLocalHandleKey,
  createNewLayerDocumentEditorProject,
} from "@/editor/layerDocumentEditorProjectIdentity";
import type {
  LayerDocumentProjectLifecycleController,
  LayerDocumentProjectOpenController,
  LayerDocumentProjectReconnectController,
  LayerDocumentProjectSaveController,
} from "@/engines/project";

const initialProject =
  createInitialLayerDocumentOwnerOptions().project;
let projectSequence = 0;
const createDeterministicProject = () =>
  createNewLayerDocumentEditorProject(
    () => `project:new:${++projectSequence}`
  );
const firstNewProject =
  createDeterministicProject();
const secondNewProject =
  createDeterministicProject();
assert.notEqual(
  firstNewProject.metadata.projectId,
  secondNewProject.metadata.projectId
);
assert.notEqual(
  buildLayerDocumentLocalHandleKey(
    firstNewProject.metadata.projectId,
    "locator:shared"
  ),
  buildLayerDocumentLocalHandleKey(
    secondNewProject.metadata.projectId,
    "locator:shared"
  ),
  "New Projects must not collide in the session-local handle registry"
);
assert.equal(
  createInitialLayerDocumentOwnerOptions().project
    .metadata.projectId,
  initialProject.metadata.projectId,
  "The initial bootstrap identity remains compatible"
);
let dirty: "clean" | "dirty" = "dirty";
let document:
  "untitled" | "file-backed" = "untitled";
let operation:
  "idle" | "saving" | "loading" = "idle";
let replacements = 0;
let targetClears = 0;
let confirmations = 0;
let notifications = 0;
let saveFailure = false;
let openFailure = false;
let reconnectConfirmation = false;
let importedPsdFileNames: readonly string[] = [];
const replacedProjectIds: string[] = [];

const lifecycle = {
  read: () => ({
    document,
    dirty,
    operation,
    operationToken: null,
    savepointDigest: "saved",
    currentProjectDigest:
      dirty === "dirty" ? "edited" : "saved",
  }),
  replaceProject: ({ project, document: nextDocument }) => {
    replacements += 1;
    replacedProjectIds.push(
      project.metadata.projectId
    );
    dirty = "clean";
    document = nextDocument;
    return {
      ok: true as const,
      value: {
        ok: true as const,
        changed: true,
        state: {} as never,
        effect: {} as never,
      },
    };
  },
} as unknown as
  LayerDocumentProjectLifecycleController;
const save = {
  readTarget: () => null,
  commitTarget: () => {
    targetClears += 1;
  },
  save: async () => {
    operation = "saving";
    await Promise.resolve();
    operation = "idle";
    if (!saveFailure) document = "file-backed";
    return saveFailure
      ? {
          ok: false as const,
          error: {
            code: "write-failed" as const,
            message: "write failed",
          },
        }
      : {
          ok: true as const,
          lifecycle: lifecycle.read(),
          targetKind:
            "native-file-system" as const,
          byteLength: 1,
        };
  },
  saveAs: async () => ({
    ok: false as const,
    error: {
      code: "cancelled" as const,
      message: "cancelled",
    },
  }),
} satisfies LayerDocumentProjectSaveController;
const open = {
  open: async () => {
    operation = "loading";
    await Promise.resolve();
    operation = "idle";
    return openFailure
      ? {
          ok: false as const,
          error: {
            code: "invalid-project" as const,
            message: "invalid container",
          },
        }
      : {
          ok: true as const,
          readiness: "ready-degraded" as const,
          project: initialProject,
          missingSourceIds: ["source:missing"],
          errorSourceIds: [],
        };
  },
} satisfies LayerDocumentProjectOpenController;
const reconnect = {
  read: () => ({
    items: [{
      sourceId: "source:missing",
      displayName: "Missing PSD",
      suggestedFileName: "missing.psd",
      status: "missing" as const,
      fingerprintPolicy:
        "legacy-unverified" as const,
      dependentSourceIds: ["source:missing"],
      dependentLayerDocumentIds: [],
    }],
  }),
  reconnect: async () =>
    reconnectConfirmation
      ? {
          ok: true as const,
          status:
            "confirmation-required" as const,
          sourceId: "source:missing",
          reason:
            "legacy-unverified-fingerprint" as const,
          expectedFingerprint: null,
          actualFingerprint: {
            algorithm: "sha-256" as const,
            digestHex: "00",
            byteLength: 1,
          },
          choices: [
            "refresh-source",
            "replace-source",
          ] as const,
        }
      : {
          ok: true as const,
          status: "reconnected" as const,
          sourceId: "source:missing",
          availableSourceIds: ["source:missing"],
          missingSourceIds: [],
        },
} satisfies LayerDocumentProjectReconnectController;

let confirmResult = false;
const commands =
  createProjectLifecycleUiCommandPort({
    lifecycle,
    save,
    open,
    reconnect,
    createNewProject:
      createDeterministicProject,
    importPsdFiles: async (files) => {
      importedPsdFileNames = files.map(
        (file) => file.name
      );
      return true;
    },
    confirmDiscard: () => {
      confirmations += 1;
      return confirmResult;
    },
    notify: () => {
      notifications += 1;
    },
  });

const projectTarget = {
  kind: "native-file-system" as const,
  fileName: "Test Project.ziq",
  handle: {
    name: "Test Project.ziq",
    createWritable: async () => ({
      write: async () => {},
      close: async () => {},
    }),
  },
};
const newProjectRequest = (
  projectName: string,
  psdFiles: readonly File[] = []
) => ({
  projectName,
  directoryName: "Selected Folder",
  psdFiles,
  target: projectTarget,
});

assert.equal(commands.read().projectCreated, false);
await commands.newProject(
  newProjectRequest("Cancelled Project")
);
assert.equal(confirmations, 1);
assert.equal(replacements, 0);
assert.equal(targetClears, 0);
assert.equal(commands.read().dirty, "dirty");
assert.equal(commands.read().notice?.code, "cancelled");

confirmResult = true;
await commands.closeProject();
assert.equal(replacements, 1);
assert.equal(targetClears, 1);
assert.equal(commands.read().dirty, "clean");
await commands.newProject(newProjectRequest("First"));
await commands.newProject(newProjectRequest("Second"));
const newProjectIds =
  replacedProjectIds.slice(-2);
assert.equal(newProjectIds.length, 2);
assert.notEqual(
  newProjectIds[0],
  newProjectIds[1],
  "Two New commands in one session require distinct Project identities"
);
assert.notEqual(
  buildLayerDocumentLocalHandleKey(
    newProjectIds[0]!,
    "locator:shared"
  ),
  buildLayerDocumentLocalHandleKey(
    newProjectIds[1]!,
    "locator:shared"
  )
);

const replacementsBeforeEmptyFolder = replacements;
await commands.newProject(
  newProjectRequest("Empty Folder")
);
assert.equal(replacements, replacementsBeforeEmptyFolder + 1);
assert.equal(
  commands.read().notice?.code,
  "new-project"
);
assert.equal(commands.read().projectCreated, true);
assert.equal(
  commands.read().projectLocation,
  "Selected Folder/Test Project.ziq"
);
await commands.newProject(
  newProjectRequest("PSD Project", [
    new File([new Uint8Array([1])], "first.psd"),
    new File([new Uint8Array([2])], "second.psd"),
  ])
);
assert.deepEqual(
  importedPsdFileNames,
  ["first.psd", "second.psd"]
);
assert.equal(
  commands.read().notice?.message,
  "PSD Project.ziq 프로젝트를 만들고 PSD 2개를 불러왔습니다."
);

dirty = "dirty";
openFailure = true;
await commands.openProject();
assert.equal(
  commands.read().notice?.code,
  "invalid-project"
);
assert.equal(
  commands.read().notice?.tone,
  "error"
);

saveFailure = true;
await commands.saveProject();
assert.equal(
  commands.read().notice?.code,
  "write-failed"
);
assert.ok(notifications > 0);

reconnectConfirmation = true;
await commands.reconnectSource("source:missing");
assert.equal(
  commands.read().notice?.code,
  "legacy-unverified-fingerprint"
);
assert.equal(
  commands.read().notice?.tone,
  "warning"
);
assert.equal(
  commands.read().missingSources.length,
  1
);

const barSource = readFileSync(
  "src/editor/ProjectLifecycleBar.tsx",
  "utf8"
);
assert.doesNotMatch(
  barSource,
  /@\/engines|owner\.transition|currentProject|showDirectoryPicker|getDirectoryHandle|createPortal/
);
assert.match(
  barSource,
  /useProjectLifecycleUiController/
);
assert.match(
  barSource,
  /composeProjectLifecycleUiViewProps/
);
assert.match(barSource, /ProjectLifecycleView/);

const directoryAdapterSource = readFileSync(
  "src/editor/project-lifecycle/adapters/projectLifecycleBrowserDirectoryAdapter.ts",
  "utf8"
);
assert.doesNotMatch(
  directoryAdapterSource,
  /from "react"|ProjectLifecycleController|owner\.transition/
);
assert.match(
  directoryAdapterSource,
  /showDirectoryPicker/
);
assert.match(
  directoryAdapterSource,
  /queueProjectOpenSelection/
);
assert.match(
  directoryAdapterSource,
  /getDirectoryHandle\("psd"/
);
assert.match(
  directoryAdapterSource,
  /getDirectoryHandle\("audio"/
);

const controllerSource = readFileSync(
  "src/editor/project-lifecycle/controllers/projectLifecycleUiController.ts",
  "utf8"
);
assert.doesNotMatch(
  controllerSource,
  /from "react"|createPortal|showDirectoryPicker|owner\.transition/
);
assert.match(
  controllerSource,
  /commands\.(newProject|openProject|saveProject|saveProjectAs|closeProject|reconnectSource)/
);
assert.match(
  controllerSource,
  /activeIntent/
);

const composerSource = readFileSync(
  "src/editor/project-lifecycle/composers/projectLifecycleUiComposer.ts",
  "utf8"
);
assert.doesNotMatch(
  composerSource,
  /showDirectoryPicker|window\.|getDirectoryHandle|setProjectAssetDirectory|commands\./
);
assert.match(
  composerSource,
  /ProjectLifecycleViewProps/
);

const componentFiles = [
  "MissingSourceBanner.tsx",
  "NewProjectDialog.tsx",
  "ProjectLifecycleToolbar.tsx",
  "ProjectLifecycleView.tsx",
  "ProjectStartScreen.tsx",
];
const componentSource = componentFiles
  .map((file) => readFileSync(
    `src/features/project-lifecycle/components/${file}`,
    "utf8"
  ))
  .join("\n");
assert.doesNotMatch(
  componentSource,
  /@\/engines|owner\.transition|currentProject|showDirectoryPicker|getDirectoryHandle|setProjectAssetDirectory/
);
assert.match(componentSource, /project-start-screen/);
assert.match(componentSource, /프로젝트 열기/);
assert.match(componentSource, /createPortal/);

const lifecycleViewSource = readFileSync(
  "src/features/project-lifecycle/components/ProjectLifecycleView.tsx",
  "utf8"
);
assert.doesNotMatch(
  lifecycleViewSource,
  /createPortal/
);
assert.match(
  lifecycleViewSource,
  /<ProjectExportDialog/
);
const exportDialogSource = readFileSync(
  "src/editor/ProjectExportDialog.tsx",
  "utf8"
);
assert.match(exportDialogSource, /createPortal/);

const shellLayoutSource = readFileSync(
  "src/editor/EditorShellLayout.tsx",
  "utf8"
);
assert.match(
  shellLayoutSource,
  /projectLifecycleProps\.viewModel[\s\S]*\.projectCreated[\s\S]*\? 10[\s\S]*: "auto"/
);
const commandSource = readFileSync(
  "src/editor/projectLifecycleUi.ts",
  "utf8"
);
assert.doesNotMatch(
  commandSource,
  /owner\.transition|sourceRuntime|draftSession|playback/
);

console.log(
  "LayerDocument Project lifecycle UI verification passed"
);
