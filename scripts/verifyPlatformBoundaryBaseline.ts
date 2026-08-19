import assert from "node:assert/strict";
import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return collectSourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

function label(file: string) {
  return relative(root, file).split(sep).join("/");
}

function sorted(values: Iterable<string>) {
  return [...values].sort();
}

function assertBaseline(
  actual: Iterable<string>,
  expected: Readonly<Record<string, number>>,
  name: string
) {
  assert.deepEqual(
    sorted(actual),
    sorted(Object.keys(expected)),
    `${name} baseline이 달라졌습니다. 새 위반은 추가하지 말고 제거된 위반만 해당 Sprint에서 baseline과 함께 갱신하세요.`
  );
}

const files = collectSourceFiles(sourceRoot);
const gatewayContractFiles = files.filter((file) =>
  label(file).startsWith("src/gateway/contracts/")
);
const gatewayAdapterFiles = files.filter((file) =>
  label(file).startsWith("src/gateway/platforms/")
);
const platformTypePattern =
  /\b(?:File|FileList|Blob|FileSystemFileHandle|FileSystemDirectoryHandle|MediaStream|MediaRecorder|AudioContext|HTMLElement|HTMLCanvasElement)\b/;
const controllerPlatformPattern =
  /\b(?:window|document|navigator|MediaRecorder|MediaStream|FileSystemFileHandle|FileSystemDirectoryHandle|showOpenFilePicker|showSaveFilePicker|showDirectoryPicker)\b/;

const contractPlatformTypeBaseline: Readonly<
  Record<string, number>
> = {
  "src/engines/canvas/models/canvasEngineModel.ts": 10,
  "src/engines/canvas/models/canvasPreviewPaneModel.ts": 10,
  "src/engines/canvas/models/canvasSelectionAlphaModel.ts": 10,
  "src/engines/canvas/models/canvasSelectionHighlightModel.ts": 10,
  "src/engines/canvas/models/layerDocumentCanvasReadModel.ts": 10,
  "src/engines/project/models/layerDocumentProjectBrowserWriteModel.ts": 3,
  "src/engines/project/models/layerDocumentProjectOpenModel.ts": 3,
  "src/engines/project/models/psdSourceRuntimeModel.ts": 5,
  "src/engines/psd-tree/models/psdTreeModel.ts": 5,
};

const controllerPlatformBaseline: Readonly<
  Record<string, number>
> = {
  "src/engines/canvas/controllers/useCanvasGizmoController.ts": 10,
  "src/engines/canvas/controllers/useCanvasPanController.ts": 10,
  "src/engines/canvas/controllers/useCanvasPointerController.ts": 10,
  "src/engines/canvas/controllers/useLayerDocumentCanvasDirectSelectionController.ts": 10,
  "src/engines/library/controllers/useLibraryAudioImportController.ts": 5,
  "src/engines/library/controllers/useLibraryDragController.ts": 10,
  "src/engines/library/controllers/useLibraryHoverPreviewController.ts": 10,
  "src/engines/library/controllers/useLibraryPsdImportController.ts": 5,
  "src/engines/project/controllers/layerDocumentLibraryController.ts": 6,
  "src/engines/project/controllers/layerDocumentProjectLifecycleController.ts": 4,
  "src/engines/project/controllers/layerDocumentProjectOpenController.ts": 3,
  "src/engines/project/controllers/layerDocumentProjectReconnectController.ts": 6,
  "src/engines/timeline/controllers/timelinePointerDragSessionController.ts": 10,
  "src/engines/timeline/controllers/useTimelinePlaybackUIController.ts": 10,
};

const projectFacadeDependencyBaseline: Readonly<
  Record<string, number>
> = {
  "src/engines/canvas/adapters/layerDocumentCanvasDraftAdapter.ts": 10,
  "src/engines/library/adapters/layerDocumentAudioImportCommandAdapter.ts": 5,
  "src/engines/library/adapters/layerDocumentLibrarySourceCommandAdapter.ts": 5,
  "src/engines/library/controllers/createLibraryNodeCommandController.ts": 2,
  "src/engines/library/controllers/libraryRecordingSessionController.ts": 8,
  "src/engines/library/controllers/useLibraryAudioImportController.ts": 5,
  "src/engines/library/controllers/useLibraryDragController.ts": 2,
  "src/engines/library/controllers/useLibraryPsdImportController.ts": 5,
  "src/engines/library/helpers/libraryPsdImportViewHelpers.ts": 5,
  "src/engines/library/helpers/libraryTreeProjectionHelpers.ts": 5,
  "src/engines/library/models/layerDocumentPsdConfirmModel.ts": 5,
  "src/engines/library/models/libraryEngineModel.ts": 5,
  "src/engines/library/models/libraryModel.ts": 5,
  "src/engines/library/models/libraryRecordingModel.ts": 8,
  "src/engines/menu/models/menuProjectCommandModel.ts": 4,
  "src/engines/project/controllers/layerDocumentPsdPreparedSessionController.ts": 5,
  "src/engines/visual/adapters/layerDocumentPropertiesCommandPortAdapter.ts": 7,
  "src/engines/visual/adapters/layerDocumentPropertiesNexusCommandAdapter.ts": 7,
  "src/engines/psd-tree/adapters/layerDocumentPsdPreparedSourceAdapter.ts": 5,
  "src/engines/psd-tree/models/layerDocumentPsdConfirmModel.ts": 5,
  "src/engines/psd-tree/models/psdTreeModel.ts": 5,
  "src/engines/psd-tree/useLayerDocumentPsdTreeEngine.ts": 5,
  "src/engines/timeline/adapters/layerDocumentTimelineConsumerAdapter.ts": 2,
  "src/engines/timeline/adapters/layerDocumentTimelineIntentCommitAdapter.ts": 2,
  "src/engines/timeline/models/layerDocumentTimelineEngineModel.ts": 2,
};

const controllerInstanceDependencyBaseline: Readonly<
  Record<string, number>
> = {
  "src/engines/project/models/layerDocumentProjectOpenModel.ts": 4,
};

for (const file of gatewayContractFiles) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(
    source,
    /\b(?:File|FileList|Blob|FileSystemFileHandle|FileSystemDirectoryHandle|MediaRecorder|MediaStream|AudioContext|HTMLElement|HTMLCanvasElement)\b|\b(?:window|document|navigator)\s*\./,
    `${label(file)}: Gateway contract가 Platform type/API에 의존`
  );
}

for (const file of gatewayAdapterFiles) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /@\/(?:editor\/nexus|nexus)|layerDocumentNexus(?:Reducer|Action|Transaction)/,
    `${label(file)}: Gateway Adapter가 Nexus mutation 경계에 의존`
  );
}

for (const file of files.filter((candidate) =>
  /^src\/engines\/(?:menu|audio|library)\//.test(label(candidate))
)) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /from ["']@\/editor(?:\/|["'])/,
    `${label(file)}: Panel Engine이 Editor 구현을 역방향 import`
  );
}

for (const file of files.filter((candidate) =>
  /^src\/engines\/[^/]+\/controllers\//.test(label(candidate))
)) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /@\/gateway\/platforms\//,
    `${label(file)}: Controller가 구체 Gateway Platform Adapter를 import`
  );
}

const engineModelPlatformFiles = files.filter((file) => {
  const path = label(file);
  return (
    /^src\/engines\/[^/]+\/models\//.test(path) &&
    platformTypePattern.test(readFileSync(file, "utf8"))
  );
});
assertBaseline(
  engineModelPlatformFiles.map(label),
  contractPlatformTypeBaseline,
  "Engine model Platform type"
);

const controllerPlatformFiles = files.filter((file) => {
  const path = label(file);
  return (
    /^src\/engines\/[^/]+\/controllers\//.test(path) &&
    controllerPlatformPattern.test(readFileSync(file, "utf8"))
  );
});
assertBaseline(
  controllerPlatformFiles.map(label),
  controllerPlatformBaseline,
  "Controller Platform API"
);

const projectFacadeFiles = files.filter((file) => {
  const path = label(file);
  return (
    path.startsWith("src/engines/") &&
    /from ["']@\/engines\/project["']/.test(
      readFileSync(file, "utf8")
    )
  );
});
assertBaseline(
  projectFacadeFiles.map(label),
  projectFacadeDependencyBaseline,
  "Project façade dependency"
);

const controllerInstanceFiles = files.filter((file) => {
  const path = label(file);
  return (
    /^src\/engines\/[^/]+\/models\//.test(path) &&
    /readonly [A-Za-z0-9_]+Controller\??:/.test(
      readFileSync(file, "utf8")
    )
  );
});
assertBaseline(
  controllerInstanceFiles.map(label),
  controllerInstanceDependencyBaseline,
  "Controller instance dependency"
);

const nexusCandidateFiles = files.filter((file) => {
  const path = label(file);
  return (
    path.startsWith("src/editor/nexus/") ||
    /src\/engines\/project\/(?:actions|helpers)\/layerDocumentNexus/.test(
      path
    )
  );
});
for (const file of nexusCandidateFiles) {
  const text = readFileSync(file, "utf8");
  assert.doesNotMatch(
    text,
    /\b(?:window|document|navigator)\s*\.|\b(?:File|FileList|Blob|FileSystemFileHandle|FileSystemDirectoryHandle|MediaRecorder|MediaStream|AudioContext)\b/,
    `${label(file)}: Nexus 후보 경계가 Platform API/type에 의존`
  );
  assert.doesNotMatch(
    text,
    /@\/(?:features|editor\/project-lifecycle)\//,
    `${label(file)}: Nexus 후보 경계가 UI/Lifecycle 구현에 의존`
  );
}

for (const [file, sprint] of [
  ...Object.entries(contractPlatformTypeBaseline),
  ...Object.entries(controllerPlatformBaseline),
  ...Object.entries(projectFacadeDependencyBaseline),
  ...Object.entries(controllerInstanceDependencyBaseline),
]) {
  assert.ok(
    Number.isInteger(sprint) && sprint >= 2 && sprint <= 10,
    `${file}: 제거 예정 Sprint 번호가 유효하지 않음`
  );
}

console.log("Platform boundary baseline verification passed");
