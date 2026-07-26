import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const iconSource = readFileSync(
  "src/shared/components/LayerCompositionIcon.tsx",
  "utf8"
);
assert.match(iconSource, /kind: "layer" \| "composition"/);
assert.match(iconSource, /size\?: number/);
assert.match(iconSource, /size = 14/);
assert.doesNotMatch(iconSource, /^import /m);
assert.match(iconSource, /const FRONT_PLANE_PATH = "[^"]+"/);
assert.match(iconSource, /kind === "composition" \? \[8, 4, 0\] : \[0\]/);
assert.equal(iconSource.match(/<path/g)?.length, 1);
assert.match(iconSource, /d=\{FRONT_PLANE_PATH\}/);
assert.match(iconSource, /fill="none"/);
assert.match(iconSource, /stroke="currentColor"/);
assert.match(iconSource, /strokeLinecap="round"/);
assert.match(iconSource, /strokeLinejoin="round"/);
assert.match(iconSource, /aria-hidden="true"/);
assert.match(iconSource, /focusable="false"/);

const timelineItemSource = readFileSync(
  "src/features/timeline/components/TimelineItemTrackRow.tsx",
  "utf8"
);
const breadcrumbSource = readFileSync(
  "src/features/timeline/components/TimelineSelectionBreadcrumb.tsx",
  "utf8"
);
const switcherSource = readFileSync(
  "src/features/timeline/components/TimelineCompositionSwitcher.tsx",
  "utf8"
);
const propertiesSource = readFileSync(
  "src/features/properties/components/PropertiesPanel.tsx",
  "utf8"
);
const propertiesModelSource = readFileSync(
  "src/engines/properties/models/propertiesEngineModel.ts",
  "utf8"
);
const psdTreeSource = readFileSync(
  "src/features/psdtree/components/PsdTreeNode.tsx",
  "utf8"
);
const importPreviewSource = readFileSync(
  "src/features/psdtree/components/PsdImportPreviewNode.tsx",
  "utf8"
);

assert.match(
  timelineItemSource,
  /kind=\{item\.entityKind\}/
);
assert.match(breadcrumbSource, /segment\.entityKind/);
assert.match(breadcrumbSource, /selectionLabel\.entityKind/);
assert.match(switcherSource, /LayerCompositionIcon kind="composition"/);
assert.match(propertiesSource, /kind=\{readModel\.targetEntityKind\}/);
assert.match(
  propertiesModelSource,
  /targetEntityKind: "layer" \| "composition" \| null/
);
assert.match(psdTreeSource, /<PsdFileIcon \/>/);
assert.match(
  psdTreeSource,
  /kind=\{node\.entityKind \?\? "layer"\}/
);
assert.match(importPreviewSource, /node\.kind === "group" \? "▱"/);
assert.match(importPreviewSource, /LayerCompositionIcon kind="layer"/);

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return collectSourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

for (const file of collectSourceFiles("src/engines")) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /@\/shared\/components\/LayerCompositionIcon/,
    `${file}: Engine은 shared React icon을 import할 수 없습니다.`
  );
}

console.log("Entity kind icon verification passed");
