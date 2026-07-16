import assert from "node:assert/strict";
import { initializeCanvas, writePsd, type PixelData, type Psd } from "ag-psd";
import { loadPsd } from "@/engines/project/import/psdLoader";
import { importPsdSourcesIntoProject } from "@/engines/project/helpers/psd/psdImportProjectHelpers";

type TestImageData = ImageData & { data: Uint8ClampedArray };

class TestCanvasContext {
  private pixels: Uint8ClampedArray;
  private readonly canvas: TestCanvas;

  constructor(canvas: TestCanvas) {
    this.canvas = canvas;
    this.pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
  }

  createImageData(width: number, height: number): TestImageData {
    return createImageData(width, height);
  }

  putImageData(imageData: TestImageData) {
    this.pixels = new Uint8ClampedArray(imageData.data);
  }

  getImageData(): TestImageData {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
      data: new Uint8ClampedArray(this.pixels),
      colorSpace: "srgb",
    } as TestImageData;
  }
}

class TestCanvas {
  readonly context: TestCanvasContext;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.context = new TestCanvasContext(this);
  }

  getContext() {
    return this.context;
  }
}

function createImageData(width: number, height: number, red = 0): TestImageData {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < data.length; index += 4) {
    data[index] = red;
    data[index + 3] = 255;
  }

  return { width, height, data, colorSpace: "srgb" } as TestImageData;
}

initializeCanvas(
  (width, height) => new TestCanvas(width, height) as unknown as HTMLCanvasElement,
  (width, height) => createImageData(width, height)
);

const sourcePsd: Psd = {
  width: 8,
  height: 6,
  imageData: createImageData(8, 6) as PixelData,
  children: [
    {
      name: "Background",
      left: 1,
      top: 2,
      right: 5,
      bottom: 4,
      opacity: 0.5,
      imageData: createImageData(4, 2, 32) as PixelData,
    },
    {
      name: "Controls",
      hidden: true,
      children: [
        {
          name: "Button",
          left: 2,
          top: 1,
          right: 5,
          bottom: 3,
          imageData: createImageData(3, 2, 192) as PixelData,
        },
      ],
    },
  ],
};
const psdBytes = writePsd(sourcePsd);
const sourceFile = new File([psdBytes], "fixture.psd", {
  type: "image/vnd.adobe.photoshop",
});

const parsed = await loadPsd(sourceFile, 7);
const main = parsed.composition;
const nested = main.children[0];

assert.equal(main.id, "main-7-fixture");
assert.equal(main.name, "fixture.psd");
assert.equal(main.sourceSyncStatus, "normal");
assert.equal(main.layers.length, 1);
assert.equal(main.layers[0]?.name, "Background");
assert.deepEqual(main.layers[0]?.position, { x: 3, y: 3 });
assert.equal(main.layers[0]?.opacity, 50);
assert.equal(nested?.name, "Controls");
assert.equal(nested?.parentId, main.id);
assert.equal(nested?.layers[0]?.name, "Button");
assert.equal(parsed.metaByCompId[main.id]?.layerCount, 2);
assert.equal(parsed.metaByCompId[nested.id]?.layerCount, 1);
assert.equal(parsed.timelineItemsByCompId[main.id]?.length, 2);
assert.equal(parsed.timelineItemsByCompId[main.id]?.[0]?.kind, "subComp");
assert.equal(parsed.timelineItemsByCompId[main.id]?.[0]?.visible, false);
assert.equal(parsed.timelineItemsByCompId[nested.id]?.[0]?.kind, "layer");
assert.equal(parsed.renderItemsByCompId[main.id]?.[0]?.kind, "subComp");
assert.equal(parsed.renderItemsByCompId[nested.id]?.[0]?.drawables[0]?.canvas?.width, 3);
assert.ok(main.sourceFingerprint);
assert.ok(main.layers[0]?.sourceFingerprint);

const ignoredFile = new File(["not a psd"], "notes.txt", { type: "text/plain" });
const initialState = {
  comps: [],
  metaByCompId: {},
  timelineItemsByCompId: {},
  renderItemsByCompId: {},
  nextImportIndex: 0,
};
const firstImport = await importPsdSourcesIntoProject(
  [{ file: ignoredFile }, { file: sourceFile }],
  initialState
);

assert.equal(firstImport.comps.length, 1);
assert.equal(firstImport.nextImportIndex, 1);
assert.deepEqual(firstImport.failedFiles, []);
assert.deepEqual(firstImport.replacedFiles, []);
assert.equal(firstImport.importedSources[0]?.fileName, "fixture.psd");

const replacement = await importPsdSourcesIntoProject(
  [{ file: sourceFile }],
  firstImport
);

assert.equal(replacement.comps.length, 1);
assert.equal(replacement.nextImportIndex, 2);
assert.deepEqual(replacement.replacedFiles, ["fixture.psd"]);
assert.equal(replacement.importedSources[0]?.replacedCompId, "main-0-fixture");
assert.equal(replacement.comps[0]?.id, "main-1-fixture");
assert.equal(replacement.metaByCompId["main-0-fixture"], undefined);
assert.equal(replacement.timelineItemsByCompId["main-0-fixture"], undefined);
assert.equal(replacement.renderItemsByCompId["main-0-fixture"], undefined);

console.log("PSD binary/import pipeline verification passed");
