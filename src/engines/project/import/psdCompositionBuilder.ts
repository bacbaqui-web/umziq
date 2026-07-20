import type { Layer as PsdLayer, Psd } from "ag-psd";
import type {
  Composition,
  CompositionMeta,
  Layer,
  PsdImportSettings,
  TimelineItem,
} from "@/models";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";
import type { PsdImportPlanNode } from "@/engines/project/models/psdImportPlanModel";
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
import {
  buildPsdSourceKey,
  countPsdLayerIds,
  createPsdSourceIdentity,
} from "@/engines/project/import/psdSourceIdentityHelpers";
import { normalizePsdImportSettings } from "@/engines/project/import/psdImportSettingsHelpers";

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
  height: number,
  parentLegacyTreeKey: string,
  layerIdCounts: ReadonlyMap<number, number>,
  importSettings: PsdImportSettings
) {
  const containers = createGroupContainers();
  let layerIndex = 0;
  let childCompIndex = 0;

  sourceLayers.forEach((layer, index) => {
    if (importSettings.hiddenLayerMode === "omit" && layer.hidden) return;
    const fallbackName = isGroupLayer(layer) ? `Group ${childCompIndex + 1}` : `Layer ${index + 1}`;
    const sourceName = sanitizeName(layer.name, fallbackName);
    const sourcePath = joinPsdSourcePath(parentSourcePath, sourceName);
    const legacyTreeKey = `${parentLegacyTreeKey}/${index}`;
    const sourceIdentity = createPsdSourceIdentity(
      fileName,
      buildPsdSourceKey(layer, legacyTreeKey, layerIdCounts)
    );

    if (isGroupLayer(layer)) {
      childCompIndex += 1;
      const parsedChild = parseNestedComposition(
        layer,
        ownerCompId,
        childCompIndex,
        sourcePath,
        fileName,
        width,
        height,
        sourceIdentity,
        legacyTreeKey,
        layerIdCounts,
        importSettings
      );

      registerParsedChild(containers, parsedChild);
      appendSubCompositionEntries(containers, ownerCompId, parsedChild, childCompIndex, !!layer.hidden);
      return;
    }

    const nextLayer = createLayer(
      ownerCompId,
      layer,
      layerIndex,
      `Layer ${index + 1}`,
      sourcePath,
      undefined,
      sourceIdentity
    );
    appendLayerEntries(containers, ownerCompId, nextLayer, layerIndex, layer, `Layer ${index + 1}`);
    layerIndex += 1;
  });

  return containers;
}

type PlannedCompositionSource = {
  nodes: PsdImportPlanNode[];
  sourceNodeByKey: Map<string, PsdLayer>;
};

function collectPlannedCompositionContents(
  ownerCompId: string,
  source: PlannedCompositionSource,
  parentSourcePath: string | undefined,
  fileName: string,
  width: number,
  height: number,
  importSettings: PsdImportSettings
) {
  const containers = createGroupContainers();
  let layerIndex = 0;
  let childCompIndex = 0;

  source.nodes.forEach((planNode, index) => {
    const psdLayer = source.sourceNodeByKey.get(planNode.sourceKey);
    if (!psdLayer) throw new Error(`PSD source node not found: ${planNode.sourceKey}`);
    if (importSettings.hiddenLayerMode === "omit" && psdLayer.hidden) return;
    const sourcePath = joinPsdSourcePath(parentSourcePath, planNode.displayName);

    if (planNode.kind === "group") {
      childCompIndex += 1;
      const compId = `${ownerCompId}-sub-${childCompIndex}`;
      const childContainers = collectPlannedCompositionContents(
        compId,
        { nodes: planNode.children, sourceNodeByKey: source.sourceNodeByKey },
        sourcePath,
        fileName,
        width,
        height,
        importSettings
      );
      const composition = createBaseComposition({
        id: compId,
        name: planNode.displayName,
        type: "sub",
        parentId: ownerCompId,
        sourcePath,
        sourceIdentity: createPsdSourceIdentity(fileName, planNode.sourceKey),
        sourceFingerprint: buildCompositionSourceFingerprint(childContainers),
        sourceSyncStatus: "normal",
        children: childContainers.children,
        layers: childContainers.layers,
        width,
        height,
      });
      childContainers.metaByCompId[compId] = createMeta(
        fileName,
        width,
        height,
        childContainers.children.length + childContainers.layers.length
      );
      childContainers.timelineItemsByCompId[compId] = childContainers.timelineItems;
      childContainers.renderItemsByCompId[compId] = childContainers.renderItems;
      const parsedChild: ParsedPsdDocument = {
        composition,
        metaByCompId: childContainers.metaByCompId,
        timelineItemsByCompId: childContainers.timelineItemsByCompId,
        renderItemsByCompId: childContainers.renderItemsByCompId,
      };
      registerParsedChild(containers, parsedChild);
      appendSubCompositionEntries(
        containers,
        ownerCompId,
        parsedChild,
        childCompIndex,
        !!psdLayer.hidden
      );
      return;
    }

    const nextLayer = createLayer(
      ownerCompId,
      psdLayer,
      layerIndex,
      `Layer ${index + 1}`,
      sourcePath,
      planNode.displayName,
      createPsdSourceIdentity(fileName, planNode.sourceKey)
    );
    appendLayerEntries(
      containers,
      ownerCompId,
      nextLayer,
      layerIndex,
      psdLayer,
      planNode.displayName
    );
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
  height: number,
  sourceIdentity: NonNullable<Composition["sourceIdentity"]>,
  legacyTreeKey: string,
  layerIdCounts: ReadonlyMap<number, number>,
  importSettings: PsdImportSettings
): ParsedPsdDocument {
  const compId = `${parentId}-sub-${index}`;
  const orderedChildren = normalizeStackingOrder(group.children ?? []);
  const containers = collectCompositionContents(
    compId,
    orderedChildren,
    sourcePath,
    fileName,
    width,
    height,
    legacyTreeKey,
    layerIdCounts,
    importSettings
  );
  const sourceFingerprint = buildCompositionSourceFingerprint(containers);

  const composition = createBaseComposition({
    id: compId,
    name: sanitizeName(group.name, `Group ${index}`),
    type: "sub",
    parentId,
    sourcePath,
    sourceIdentity,
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
  fileIndex: number,
  plannedSource?: PlannedCompositionSource,
  settings?: unknown
): ParsedPsdDocument {
  const importSettings = normalizePsdImportSettings(settings, fileName);
  const mainId = toCompId(fileName.replace(/\.psd$/i, ""), fileIndex);
  const orderedLayers = normalizeStackingOrder(psd.children ?? []);
  const layerIdCounts = countPsdLayerIds(psd.children ?? []);
  const containers = plannedSource
    ? collectPlannedCompositionContents(
        mainId,
        plannedSource,
        undefined,
        fileName,
        psd.width,
        psd.height,
        importSettings
      )
    : collectCompositionContents(
        mainId,
        orderedLayers,
        undefined,
        fileName,
        psd.width,
        psd.height,
        "root",
        layerIdCounts,
        importSettings
      );
  const sourceFingerprint = buildCompositionSourceFingerprint(containers);

  const composition = createBaseComposition({
    id: mainId,
    name: importSettings.compositionName,
    type: "main",
    sourcePath: fileName,
    sourceIdentity: createPsdSourceIdentity(fileName, "document"),
    importSettings,
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
    containers.children.length + containers.layers.length
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
