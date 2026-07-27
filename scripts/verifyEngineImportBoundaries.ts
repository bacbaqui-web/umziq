import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const engineNames = [
  "canvas",
  "project",
  "properties",
  "psd-tree",
  "timeline",
] as const;
const uiEngines = new Set(["canvas", "properties", "psd-tree", "timeline"]);
const coreEngines = new Set(["project"]);

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

function engineForFile(file: string) {
  const normalized = relative(sourceRoot, file).split(sep).join("/");
  const match = normalized.match(/^engines\/([^/]+)\//);
  return match?.[1] ?? null;
}

const violations: string[] = [];
const files = collectSourceFiles(sourceRoot);
const animationRoot = join(sourceRoot, "animation");
const renderRoot = join(sourceRoot, "render");
const renderFiles = collectSourceFiles(renderRoot);
const pureAnimationFiles =
  collectSourceFiles(animationRoot);
const layerTypeSupportRoot = join(
  sourceRoot,
  "layer-types"
);
const layerTypeSupportFiles =
  collectSourceFiles(layerTypeSupportRoot);
const compositionRootPath = join(sourceRoot, "editor/useEditorCompositionRoot.ts");
const layerDocumentRuntimePath = join(
  sourceRoot,
  "editor/useLayerDocumentEditorRuntime.ts"
);
const panelEnginePortsPath = join(
  sourceRoot,
  "editor/useLayerDocumentPanelEnginePorts.ts"
);
const editorShellLayoutPath = join(
  sourceRoot,
  "editor/EditorShellLayout.tsx"
);
const editorOwnerModelPath = join(
  sourceRoot,
  "editor/project-owner/models/editorProjectOwnerModel.ts"
);
const internalEngineImport = /@\/engines\/([a-z-]+)\/[^"'\s]+/g;
const engineFacadeImport = /@\/engines\/([a-z-]+)(?=["'])/g;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const owner = engineForFile(file);
  const label = relative(root, file).split(sep).join("/");
  const isEditorProjectOwner =
    label.startsWith("src/editor/project-owner/");
  const importedFacades = new Set(
    Array.from(text.matchAll(engineFacadeImport), (match) => match[1])
  );

  if (
    importedFacades.size === engineNames.length &&
    file !== compositionRootPath &&
    file !== layerDocumentRuntimePath &&
    file !== panelEnginePortsPath
  ) {
    violations.push(`${label}: Composition Root 외부에서 모든 Engine을 조립`);
  }

  for (const match of text.matchAll(internalEngineImport)) {
    if (
      owner !== match[1] &&
      !(
        isEditorProjectOwner &&
        match[1] === "project"
      )
    ) {
      violations.push(`${label}: ${match[1]} Engine façade 밖의 내부 경로를 직접 import`);
    }
  }

  if (owner && coreEngines.has(owner)) {
    if (
      /@\/(editor|features)\//.test(text)
    ) {
      violations.push(`${label}: Core Engine이 Editor/Feature에 의존`);
    }
    for (const imported of importedFacades) {
      if (uiEngines.has(imported)) {
        violations.push(`${label}: Core Engine이 UI Engine ${imported}에 의존`);
      }
    }
  }

  if (owner && uiEngines.has(owner)) {
    for (const imported of importedFacades) {
      if (uiEngines.has(imported) && imported !== owner) {
        violations.push(`${label}: UI Engine ${owner}가 UI Engine ${imported}에 의존`);
      }
    }
  }

  if (/^engines\/[^/]+\/controllers\//.test(relative(sourceRoot, file).split(sep).join("/")) && /@\/engines\/[^/]+\/controllers\//.test(text)) {
    violations.push(`${label}: Controller가 다른 Controller를 직접 import`);
  }
}

for (const file of renderFiles) {
  const text = readFileSync(file, "utf8");
  const label = relative(root, file).split(sep).join("/");
  assert.doesNotMatch(
    text,
    /@\/(?:editor|features)\//,
    `${label}: Render module이 Editor/Feature에 의존`
  );
  assert.doesNotMatch(
    text,
    /@\/engines\/(?:canvas|properties|psd-tree|timeline)\b/,
    `${label}: Render module이 Panel Engine에 의존`
  );
}
for (const file of files.filter(
  (candidate) => !candidate.startsWith(renderRoot)
)) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /from ["']@\/render\//,
    `${relative(root, file)}: Render public entry 밖의 내부 경로를 직접 import`
  );
}

for (const file of pureAnimationFiles) {
  const text = readFileSync(file, "utf8");
  const label =
    relative(root, file).split(sep).join("/");
  assert.doesNotMatch(
    text,
    /from ["']@\/(?:engines|editor|features)\//,
    `${label}: pure Animation이 runtime/editor 경계에 의존`
  );
  assert.doesNotMatch(
    text,
    /\buseState\b|\buseRef\b|\buseEffect\b|\bsubscribe\b|\bdispatch\b/,
    `${label}: pure Animation이 state/Runtime authority를 생성`
  );
}
for (const file of files) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /@\/engines\/animation/,
    `${relative(root, file)}: Panel 없는 Animation Engine 경계 대신 @/animation을 사용`
  );
}
for (const file of files.filter((candidate) =>
  !candidate.startsWith(animationRoot)
)) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /@\/animation\//,
    `${relative(root, file)}: Animation 소비자는 단일 public entry를 사용`
  );
}
assert.equal(
  files.some((file) =>
    relative(sourceRoot, file)
      .split(sep)
      .join("/")
      .startsWith("engines/animation/")
  ),
  false,
  "Animation은 독립 Panel이 없어 Engine 경로를 가질 수 없습니다."
);
assert.match(
  readFileSync(join(animationRoot, "index.ts"), "utf8"),
  /from ["']@\/animation\//,
  "pure Animation canonical public entry가 없습니다."
);
for (const file of collectSourceFiles(
  join(sourceRoot, "models")
)) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /@\/animation/,
    `${relative(root, file)}: models ↔ Animation 순환 의존`
  );
}
for (const file of layerTypeSupportFiles) {
  const text = readFileSync(file, "utf8");
  const label =
    relative(root, file).split(sep).join("/");
  assert.doesNotMatch(
    text,
    /from ["']@\/(?:engines|editor|features)\//,
    `${label}: Layer Type 지원 모듈이 Panel/Runtime 경계에 의존`
  );
  assert.doesNotMatch(
    text,
    /\buseState\b|\buseRef\b|\buseEffect\b|\bsubscribe\b|\bdispatch\b/,
    `${label}: Layer Type 지원 모듈이 state/Runtime authority를 생성`
  );
}
for (const file of files.filter((candidate) =>
  !candidate.startsWith(layerTypeSupportRoot)
)) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /@\/layer-types\//,
    `${relative(root, file)}: Layer Type 소비자는 단일 public entry를 사용`
  );
}
for (const file of files) {
  const text = readFileSync(file, "utf8");
  assert.doesNotMatch(
    text,
    /@\/engines\/(?:drawing|text|audio)/,
    `${relative(root, file)}: Panel 없는 Layer Type을 Engine으로 import`
  );
}
for (const file of collectSourceFiles(
  join(sourceRoot, "models")
)) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /@\/layer-types/,
    `${relative(root, file)}: models ↔ Layer Type 지원 모듈 순환 의존`
  );
}
for (const removedEngine of [
  "drawing",
  "text",
  "audio",
]) {
  assert.equal(
    files.some((file) =>
      relative(sourceRoot, file)
        .split(sep)
        .join("/")
        .startsWith(`engines/${removedEngine}/`)
    ),
    false,
    `${removedEngine}는 독립 Panel이 없어 Engine 경로를 가질 수 없습니다.`
  );
}

const compositionRoot = readFileSync(compositionRootPath, "utf8");
assert.match(
  compositionRoot,
  /useLayerDocumentEditorOwner/
);
assert.match(
  compositionRoot,
  /useLayerDocumentCanvasEngine/
);
assert.doesNotMatch(
  compositionRoot,
  /useEditorState|useProjectSourceSession|useTimelineEngine|useCanvasComposition/
);
const ownerRoot = readFileSync(
  join(sourceRoot, "editor/useLayerDocumentEditorOwner.ts"),
  "utf8"
);
assert.match(
  ownerRoot,
  /useEditorProjectOwner/
);
for (const nativeHook of [
  "useLayerDocumentTimelineEngine",
  "useLayerDocumentPropertiesEngine",
  "useLayerDocumentPsdTreeEngine",
  "useLayerDocumentCanvasEngine",
]) {
  assert.match(
    compositionRoot,
    new RegExp(nativeHook),
    `Composition Root에 ${nativeHook} 연결이 없습니다.`
  );
}
assert.doesNotMatch(
  ownerRoot,
  /@\/engines\/(canvas|timeline|properties|psd-tree)/
);
for (const file of files.filter((candidate) =>
  engineForFile(candidate)
)) {
  const engineSource = readFileSync(file, "utf8");
  assert.doesNotMatch(
    engineSource,
    /@\/features/,
    `${relative(root, file)} Engine이 Feature를 역참조합니다.`
  );
}

assert.equal(
  existsSync(join(sourceRoot, "cutover")),
  false,
  "src/cutover: 제거된 전환 계층이 다시 생성되었습니다."
);
for (const removedCompatibilityPath of [
  "engines/project/useLayerDocumentProjectOwner.ts",
  "engines/project/helpers/layerDocumentProjectOwnerLivePortHelpers.ts",
  "features/properties/types/propertiesPanelTypes.ts",
]) {
  assert.equal(
    existsSync(join(sourceRoot, removedCompatibilityPath)),
    false,
    `${removedCompatibilityPath}: 비-Render compatibility가 남았습니다.`
  );
}
const editorShellLayout = readFileSync(
  editorShellLayoutPath,
  "utf8"
);
for (const featureComponentPath of [
  "@/features/psdtree/components/PsdTree",
  "@/features/preview/components/PreviewWorkspacePane",
  "@/features/properties/components/PropertiesPanel",
  "@/features/timeline/components/TimelinePanel",
]) {
  assert.match(
    editorShellLayout,
    new RegExp(featureComponentPath),
    `EditorShellLayout에 ${featureComponentPath} 직접 연결이 없습니다.`
  );
}
for (const panelEngine of uiEngines) {
  assert.doesNotMatch(
    readFileSync(
      join(sourceRoot, `engines/${panelEngine}/index.ts`),
      "utf8"
    ),
    /@\/features\//,
    `${panelEngine} public barrel이 Feature component를 re-export합니다.`
  );
}
assert.match(
  readFileSync(editorOwnerModelPath, "utf8"),
  /export type EditorProjectOwnerPort\s*=\s*LayerDocumentProjectOwnerPort/,
  "EditorProjectOwnerPort가 canonical Project Owner port를 가리키지 않습니다."
);
assert.match(
  readFileSync(
    join(
      sourceRoot,
      "engines/canvas/models/canvasPreviewPaneModel.ts"
    ),
    "utf8"
  ),
  /export interface CanvasPreviewPaneProps/,
  "Canvas Feature contract가 Canvas Engine public model에 없습니다."
);
for (const file of files.filter((candidate) =>
  !candidate.startsWith(
    join(sourceRoot, "render")
  )
)) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /\bCutover\b|\bassembly\b/,
    `${relative(root, file)}: 비-Render legacy 명칭이 남았습니다.`
  );
}
assert.match(
  readFileSync(
    join(
      sourceRoot,
      "models/offlineMigration/index.ts"
    ),
    "utf8"
  ),
  /offline-only boundary/
);
const finalEditorWiring =
  `${compositionRoot}\n${readFileSync(
    join(
      sourceRoot,
      "editor/useLayerDocumentEditorRuntime.ts"
    ),
    "utf8"
  )}\n${readFileSync(
    join(
      sourceRoot,
      "editor/useLayerDocumentPanelEnginePorts.ts"
    ),
    "utf8"
  )}`;
for (const finalOwnerAdapter of [
  "createEditorProjectOwnerCommandAdapter",
  "createLayerDocumentTimelineCommandAdapter",
  "createLayerDocumentTimelineConsumerAdapter",
  "createLayerDocumentPropertiesOwnerCommandAdapter",
  "createLayerDocumentCanvasDraftAdapter",
  "createLayerDocumentPsdTreeSourceCommandAdapter",
]) {
  assert.match(
    finalEditorWiring,
    new RegExp(finalOwnerAdapter),
    `Editor wiring에 ${finalOwnerAdapter} 주입이 없습니다.`
  );
}
assert.doesNotMatch(
  finalEditorWiring,
  /buildLayerDocumentTimelineReadModel|buildLayerDocumentTimelineIntentTransaction|evaluateLayerDocumentTransform|applyLayerDocumentTransformDraft|\.prepareUpdate\(/,
  "Editor wiring에 제품 계산/mutation이 남았습니다."
);

assert.deepEqual(violations, [], violations.join("\n"));
console.log("Engine import boundary verification passed");
