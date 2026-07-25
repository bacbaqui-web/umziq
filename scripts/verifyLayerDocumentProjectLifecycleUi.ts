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
let operation:
  "idle" | "saving" | "loading" = "idle";
let replacements = 0;
let targetClears = 0;
let confirmations = 0;
let notifications = 0;
let saveFailure = false;
let openFailure = false;
let reconnectConfirmation = false;
const replacedProjectIds: string[] = [];

const lifecycle = {
  read: () => ({
    document: "untitled" as const,
    dirty,
    operation,
    operationToken: null,
    savepointDigest: "saved",
    currentProjectDigest:
      dirty === "dirty" ? "edited" : "saved",
  }),
  replaceProject: ({ project }) => {
    replacements += 1;
    replacedProjectIds.push(
      project.metadata.projectId
    );
    dirty = "clean";
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
    confirmDiscard: () => {
      confirmations += 1;
      return confirmResult;
    },
    notify: () => {
      notifications += 1;
    },
  });

await commands.newProject();
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
await commands.newProject();
await commands.newProject();
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
  /@\/engines|owner\.transition|currentProject/
);
assert.match(
  barSource,
  /commands\.(newProject|openProject|saveProject|closeProject|reconnectSource)/
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
