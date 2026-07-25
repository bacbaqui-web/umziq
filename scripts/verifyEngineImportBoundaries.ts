import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const engineNames = [
  "animation",
  "audio",
  "canvas",
  "drawing",
  "playback-render",
  "project",
  "properties",
  "psd-tree",
  "text",
  "timeline",
] as const;
const uiEngines = new Set(["canvas", "properties", "psd-tree", "timeline"]);
const coreEngines = new Set(["animation", "playback-render", "project"]);
const layerDomainEngines = new Set(["audio", "drawing", "text"]);

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
const compositionRootPath = join(sourceRoot, "editor/useEditorCompositionRoot.ts");
const layerDocumentAssemblyPath = join(
  sourceRoot,
  "editor/useLayerDocumentEditorOwner.ts"
);
const internalEngineImport = /@\/engines\/([a-z-]+)\/[^"'\s]+/g;
const engineFacadeImport = /@\/engines\/([a-z-]+)(?=["'])/g;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const owner = engineForFile(file);
  const label = relative(root, file).split(sep).join("/");
  const importedFacades = new Set(
    Array.from(text.matchAll(engineFacadeImport), (match) => match[1])
  );

  if (
    importedFacades.size === engineNames.length &&
    file !== layerDocumentAssemblyPath
  ) {
    violations.push(`${label}: Composition Root 외부에서 모든 Engine을 조립`);
  }

  for (const match of text.matchAll(internalEngineImport)) {
    if (owner !== match[1]) {
      violations.push(`${label}: ${match[1]} Engine façade 밖의 내부 경로를 직접 import`);
    }
  }

  if (owner && coreEngines.has(owner)) {
    if (/@\/(editor|features)\//.test(text)) {
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

  if (owner && layerDomainEngines.has(owner)) {
    for (const imported of importedFacades) {
      if (
        imported !== "project" &&
        imported !== owner
      ) {
        violations.push(
          `${label}: Layer Domain Engine ${owner}가 Core Project 이외의 Engine ${imported}에 의존`
        );
      }
    }
    if (/@\/(editor|features)\//.test(text)) {
      violations.push(`${label}: Layer Domain Engine ${owner}가 Editor/Feature에 의존`);
    }
  }

  if (/^engines\/[^/]+\/controllers\//.test(relative(sourceRoot, file).split(sep).join("/")) && /@\/engines\/[^/]+\/controllers\//.test(text)) {
    violations.push(`${label}: Controller가 다른 Controller를 직접 import`);
  }
}

const compositionRoot = readFileSync(compositionRootPath, "utf8");
assert.match(
  compositionRoot,
  /useLayerDocumentEditorOwner/
);
assert.match(
  compositionRoot,
  /useLayerDocumentCanvasComposition/
);
assert.doesNotMatch(
  compositionRoot,
  /useEditorState|useProjectSourceSession|useTimelineEngine|useCanvasComposition/
);
const assemblyRoot = readFileSync(
  layerDocumentAssemblyPath,
  "utf8"
);
for (const nativeHook of [
  "useLayerDocumentProjectOwner",
  "useLayerDocumentTimelineEngine",
  "useLayerDocumentPropertiesEngine",
  "useLayerDocumentPsdTreeEngine",
]) {
  assert.match(
    assemblyRoot,
    new RegExp(nativeHook),
    `LayerDocument 조립 경계에 ${nativeHook} 연결이 없습니다.`
  );
}
for (const file of files.filter((candidate) =>
  engineForFile(candidate)
)) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /@\/cutover/,
    `${relative(root, file)} Engine이 cutover를 역참조합니다.`
  );
}

assert.deepEqual(violations, [], violations.join("\n"));
console.log("Engine import boundary verification passed");
