import type { Layer as PsdLayer, Psd } from "ag-psd";
import type {
  Composition,
  CompositionMeta,
  Layer,
  TimelineItem,
} from "@/models";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";
import {
  createBaseComposition,
  createMeta,
  DEFAULT_DURATION_FRAMES,
} from "@/engines/project/import/psdDocumentFactory";
import { createDrawable, createLayer } from "@/engines/project/import/psdLayerConverter";
import {
  flattenRenderDrawables,
  isGroupLayer,
  joinPsdSourcePath,
  normalizeStackingOrder,
  sanitizeName,
  hashString,
  toCompId,
} from "@/engines/project/import/psdImportHelpers";

export interface ParsedPsdDocument {
  composition: Composition;
  metaByCompId: Record<string, CompositionMeta>;
  timelineItemsByCompId: Record<string, TimelineItem[]>;
  renderItemsByCompId: Record<string, RenderItem[]>;
}

function createGroupContainers() {
  return {
    layers: [] as Layer[],
    children: [] as Composition[],
    timelineItems: [] as TimelineItem[],
    renderItems: [] as RenderItem[],
    metaByCompId: {} as Record<string, CompositionMeta>,
    timelineItemsByCompId: {} as Record<string, TimelineItem[]>,
    renderItemsByCompId: {} as Record<string, RenderItem[]>,
  };
}

function registerParsedChild(
  containers: ReturnType<typeof createGroupContainers>,
  parsedChild: ParsedPsdDocument
) {
  containers.children.push(parsedChild.composition);
  Object.assign(containers.metaByCompId, parsedChild.metaByCompId);
  Object.assign(containers.timelineItemsByCompId, parsedChild.timelineItemsByCompId);
  Object.assign(containers.renderItemsByCompId, parsedChild.renderItemsByCompId);
}

function appendSubCompositionEntries(
  containers: ReturnType<typeof createGroupContainers>,
  ownerCompId: string,
  parsedChild: ParsedPsdDocument,
  childIndex: number,
  hidden: boolean
) {
  containers.timelineItems.push({
    id: `${ownerCompId}-timeline-sub-${childIndex}`,
    name: parsedChild.composition.name,
    kind: "subComp",
    visible: !hidden,
    compId: ownerCompId,
    sourceId: parsedChild.composition.id,
    startFrame: 0,
    durationFrames: DEFAULT_DURATION_FRAMES,
    targetCompId: parsedChild.composition.id,
  });

  containers.renderItems.push({
    id: `${ownerCompId}-render-sub-${childIndex}`,
    name: parsedChild.composition.name,
    kind: "subComp",
    visible: !hidden,
    sourceId: parsedChild.composition.id,
    targetCompId: parsedChild.composition.id,
    drawables: flattenRenderDrawables(
      parsedChild.renderItemsByCompId[parsedChild.composition.id] ?? []
    ),
  });
}

function appendLayerEntries(
  containers: ReturnType<typeof createGroupContainers>,
  ownerCompId: string,
  layer: Layer,
  drawableIndex: number,
  psdLayer: PsdLayer,
  fallbackName: string
) {
  const drawable = createDrawable(psdLayer, drawableIndex, fallbackName);
  drawable.sourceLayerId = layer.id;
  containers.layers.push(layer);
  containers.timelineItems.push({
    id: `${ownerCompId}-timeline-layer-${layer.id}`,
    name: layer.name,
    kind: "layer",
    visible: layer.visible,
    compId: ownerCompId,
    sourceId: layer.id,
    startFrame: 0,
    durationFrames: DEFAULT_DURATION_FRAMES,
  });
  containers.renderItems.push({
    id: `${ownerCompId}-render-layer-${layer.id}`,
    name: layer.name,
    kind: "layer",
    visible: layer.visible,
    sourceId: layer.id,
    drawables: [drawable],
  });
}

function buildCompositionSourceFingerprint(containers: ReturnType<typeof createGroupContainers>) {
  return hashString(
    JSON.stringify([
      ...containers.children.map((child) => ({
        kind: "subComp",
        path: child.sourcePath,
        fingerprint: child.sourceFingerprint,
        visible: true,
      })),
      ...containers.layers.map((layer) => ({
        kind: "layer",
        path: layer.sourcePath,
        fingerprint: layer.sourceFingerprint,
        visible: layer.visible,
      })),
    ])
  );
}

function collectCompositionContents(
  ownerCompId: string,
  sourceLayers: PsdLayer[],
  parentSourcePath: string | undefined,
  fileName: string,
  width: number,
  height: number
) {
  const containers = createGroupContainers();
  let layerIndex = 0;
  let childCompIndex = 0;

  sourceLayers.forEach((layer, index) => {
    const fallbackName = isGroupLayer(layer) ? `Group ${childCompIndex + 1}` : `Layer ${index + 1}`;
    const sourceName = sanitizeName(layer.name, fallbackName);
    const sourcePath = joinPsdSourcePath(parentSourcePath, sourceName);

    if (isGroupLayer(layer)) {
      childCompIndex += 1;
      const parsedChild = parseNestedComposition(
        layer,
        ownerCompId,
        childCompIndex,
        sourcePath,
        fileName,
        width,
        height
      );

      registerParsedChild(containers, parsedChild);
      appendSubCompositionEntries(containers, ownerCompId, parsedChild, childCompIndex, !!layer.hidden);
      return;
    }

    const nextLayer = createLayer(ownerCompId, layer, layerIndex, `Layer ${index + 1}`, sourcePath);
    appendLayerEntries(containers, ownerCompId, nextLayer, layerIndex, layer, `Layer ${index + 1}`);
    layerIndex += 1;
  });

  return containers;
}

function parseNestedComposition(
  group: PsdLayer,
  parentId: string,
  index: number,
  sourcePath: string,
  fileName: string,
  width: number,
  height: number
): ParsedPsdDocument {
  const compId = `${parentId}-sub-${index}`;
  const orderedChildren = normalizeStackingOrder(group.children ?? []);
  const containers = collectCompositionContents(
    compId,
    orderedChildren,
    sourcePath,
    fileName,
    width,
    height
  );
  const sourceFingerprint = buildCompositionSourceFingerprint(containers);

  const composition = createBaseComposition({
    id: compId,
    name: sanitizeName(group.name, `Group ${index}`),
    type: "sub",
    parentId,
    sourcePath,
    sourceFingerprint,
    sourceSyncStatus: "normal",
    children: containers.children,
    layers: containers.layers,
    width,
    height,
  });

  containers.metaByCompId[compId] = createMeta(fileName, width, height, orderedChildren.length);
  containers.timelineItemsByCompId[compId] = containers.timelineItems;
  containers.renderItemsByCompId[compId] = containers.renderItems;

  return {
    composition,
    metaByCompId: containers.metaByCompId,
    timelineItemsByCompId: containers.timelineItemsByCompId,
    renderItemsByCompId: containers.renderItemsByCompId,
  };
}

export function parsePsdToComposition(
  psd: Psd,
  fileName: string,
  fileIndex: number
): ParsedPsdDocument {
  const mainId = toCompId(fileName.replace(/\.psd$/i, ""), fileIndex);
  const orderedLayers = normalizeStackingOrder(psd.children ?? []);
  const containers = collectCompositionContents(
    mainId,
    orderedLayers,
    undefined,
    fileName,
    psd.width,
    psd.height
  );
  const sourceFingerprint = buildCompositionSourceFingerprint(containers);

  const composition = createBaseComposition({
    id: mainId,
    name: fileName,
    type: "main",
    sourcePath: fileName,
    sourceFingerprint,
    sourceSyncStatus: "normal",
    children: containers.children,
    layers: containers.layers,
    width: psd.width,
    height: psd.height,
  });

  containers.metaByCompId[mainId] = createMeta(
    fileName,
    psd.width,
    psd.height,
    orderedLayers.length
  );
  containers.timelineItemsByCompId[mainId] = containers.timelineItems;
  containers.renderItemsByCompId[mainId] = containers.renderItems;

  return {
    composition,
    metaByCompId: containers.metaByCompId,
    timelineItemsByCompId: containers.timelineItemsByCompId,
    renderItemsByCompId: containers.renderItemsByCompId,
  };
}
