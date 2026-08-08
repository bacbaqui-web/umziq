import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import {
  createInitialLayerDocumentOwnerOptions,
} from "@/editor/layerDocumentEditorBootstrap";
import {
  validateLayerDocumentProject,
} from "@/models";

const read = (path: string) => readFileSync(path, "utf8");
const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(ts|tsx)$/.test(path)
        ? [path]
        : [];
  });

const removedPaths = [
  "src/editor/state/useEditorState.ts",
  "src/editor/state/useEditorEngineStateStores.ts",
  "src/engines/project/useProjectSourceSession.ts",
  "src/engines/project/useProjectPsdEngine.ts",
  "src/engines/project/useProjectHistory.ts",
  "src/engines/project/useProjectCommands.ts",
  "src/engines/canvas/useCanvasComposition.ts",
  "src/engines/canvas/useCanvasEngine.ts",
  "src/engines/timeline/useTimelineEngine.ts",
  "src/engines/properties/usePropertiesEngine.ts",
  "src/engines/psd-tree/usePsdTreeEngine.ts",
  "src/render/useRenderEngine.ts",
  "src/render/usePlaybackEngine.ts",
  "src/engines/project/models/runtimeRenderModel.ts",
  "src/engines/project/models/projectCommandModel.ts",
] as const;

removedPaths.forEach((path) => {
  assert.equal(existsSync(path), false, `${path} must stay removed`);
});

const bootstrap = read("src/editor/layerDocumentEditorBootstrap.ts");
assert.doesNotMatch(
  bootstrap,
  /ProjectSourceDocument|migrateProjectSource|normalizeProjectSource/
);
const initial = createInitialLayerDocumentOwnerOptions();
assert.deepEqual(validateLayerDocumentProject(initial.project), []);
assert.equal(
  initial.project.payload.layerDocumentsById[
    "layer-document:project-root"
  ]?.type,
  "group"
);

const activeSource = [
  ...sourceFiles("src/editor"),
  ...sourceFiles("src/engines"),
  ...sourceFiles("src/features"),
].map(read).join("\n");
assert.doesNotMatch(
  activeSource,
  /\bComposition\b|\bCompositionMeta\b|\bProjectSource(?:Document)?\b|\bTimelineItem\b|\bRenderItem\b/
);
assert.doesNotMatch(
  activeSource,
  /@\/models\/(?:compositionModel|projectSourceModel|projectSourceNormalization|projectSourceToLayerDocumentMigration|projectSourceValidation|timelineItemModel|selectionModel|offlineMigration)/
);
assert.doesNotMatch(
  activeSource,
  /\bsetComps\b|\bsetTimelineItemsByCompId\b|\breplaceRenderItems\b/
);

const renderingSource = [
  ...sourceFiles("src/engines/canvas"),
  ...sourceFiles("src/render"),
].map(read).join("\n");
assert.doesNotMatch(
  renderingSource,
  /\blegacyLayerId\b|\brenderItems\b|\binputMode\b/
);

const publicModels = read("src/models/index.ts");
assert.doesNotMatch(
  publicModels,
  /compositionModel|projectSourceModel|projectSourceNormalization|projectSourceToLayerDocumentMigration|projectSourceValidation|timelineItemModel|selectionModel/
);
assert.match(
  read("src/models/offlineMigration/index.ts"),
  /projectSourceToLayerDocumentMigration/
);
assert.doesNotMatch(
  read("src/features/preview/components/PreviewWorkspacePane.tsx"),
  /"legacy"\s*\|\s*"layer-document"/
);
assert.equal(
  existsSync("src/engines/canvas/helpers/previewMemoryHelpers.ts"),
  false
);
assert.doesNotMatch(
  read("src/engines/properties/models/propertiesEngineModel.ts"),
  /transformPresentation|"legacy"/
);

for (const path of [
  "src/models/layerDocumentValidation.ts",
  "src/models/layerDocumentSourceValidation.ts",
  "src/models/layerDocumentStructureValidation.ts",
  "src/models/layerDocumentGraphValidation.ts",
  "src/models/offlineMigration/projectSourceToLayerDocumentMigration.ts",
  "src/models/offlineMigration/projectSourceMigrationIdentity.ts",
  "src/models/offlineMigration/projectSourceMigrationSourceBuilder.ts",
  "src/models/offlineMigration/projectSourceMigrationLayerBuilder.ts",
  "src/models/offlineMigration/projectSourceMigrationInputValidation.ts",
]) {
  assert.ok(
    read(path).split("\n").length < 800,
    `${path} must remain below 800 lines`
  );
}

console.log("Layer Document Legacy removal verification passed");
