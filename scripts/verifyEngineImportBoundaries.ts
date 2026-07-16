import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const engineNames = [
  "animation",
  "canvas",
  "playback-render",
  "project",
  "properties",
  "psd-tree",
  "timeline",
] as const;
const uiEngines = new Set(["canvas", "properties", "psd-tree", "timeline"]);
const coreEngines = new Set(["animation", "playback-render", "project"]);

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
const internalEngineImport = /@\/engines\/([a-z-]+)\/[^"'\s]+/g;
const engineFacadeImport = /@\/engines\/([a-z-]+)(?=["'])/g;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const owner = engineForFile(file);
  const label = relative(root, file).split(sep).join("/");
  const importedFacades = new Set(
    Array.from(text.matchAll(engineFacadeImport), (match) => match[1])
  );

  if (importedFacades.size === engineNames.length && file !== compositionRootPath) {
    violations.push(`${label}: Composition Root 외부에서 일곱 Engine을 모두 조립`);
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

  if (/^engines\/[^/]+\/controllers\//.test(relative(sourceRoot, file).split(sep).join("/")) && /@\/engines\/[^/]+\/controllers\//.test(text)) {
    violations.push(`${label}: Controller가 다른 Controller를 직접 import`);
  }
}

const compositionRoot = readFileSync(compositionRootPath, "utf8");
for (const engineName of engineNames) {
  assert.match(
    compositionRoot,
    new RegExp(`@/engines/${engineName}["']`),
    `Composition Root에 ${engineName} Engine 공개 façade 연결이 없습니다.`
  );
}

assert.deepEqual(violations, [], violations.join("\n"));
console.log("Engine import boundary verification passed");
