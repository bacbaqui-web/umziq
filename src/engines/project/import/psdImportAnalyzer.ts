import type { Layer as PsdLayer, Psd } from "ag-psd";
import type {
  PsdImportPlanNode,
  PreparedPsdImport,
} from "@/engines/project/models/psdImportPlanModel";
import type { PsdImportSource } from "@/engines/project/models/psdSourceRuntimeModel";
import {
  isGroupLayer,
  normalizeStackingOrder,
  sanitizeName,
} from "@/engines/project/import/psdImportHelpers";
import { parsePsdFile } from "@/engines/project/import/psdParser";
import {
  buildPsdSourceKey,
  countPsdLayerIds,
} from "@/engines/project/import/psdSourceIdentityHelpers";
import { createDefaultPsdImportSettings } from "@/engines/project/import/psdImportSettingsHelpers";

type AnalysisResult = {
  tree: PsdImportPlanNode[];
  sourceNodeByKey: Map<string, PsdLayer>;
  groupCount: number;
  layerCount: number;
  hiddenLayerCount: number;
};

function applyDuplicateNames(nodes: PsdImportPlanNode[]): PsdImportPlanNode[] {
  const counts = new Map<string, number>();
  nodes.forEach((node) => counts.set(node.originalName, (counts.get(node.originalName) ?? 0) + 1));
  const occurrences = new Map<string, number>();

  return nodes.map((node) => {
    const duplicate = (counts.get(node.originalName) ?? 0) > 1;
    const occurrence = (occurrences.get(node.originalName) ?? 0) + 1;
    occurrences.set(node.originalName, occurrence);
    return {
      ...node,
      displayName: duplicate ? `${node.originalName}_${occurrence}` : node.originalName,
      autoRenamed: duplicate,
      children: applyDuplicateNames(node.children),
    };
  });
}

export function normalizePsdImportPlanNames(nodes: PsdImportPlanNode[]) {
  return applyDuplicateNames(nodes);
}

export function analyzeParsedPsd(psd: Psd): AnalysisResult {
  const sourceNodeByKey = new Map<string, PsdLayer>();
  const layerIdCounts = countPsdLayerIds(psd.children ?? []);
  let groupCount = 0;
  let layerCount = 0;
  let hiddenLayerCount = 0;

  const buildNodes = (layers: PsdLayer[], parentKey: string): PsdImportPlanNode[] =>
    normalizeStackingOrder(layers).map((layer, index) => {
      const legacyTreeKey = `${parentKey}/${index}`;
      const sourceKey = buildPsdSourceKey(layer, legacyTreeKey, layerIdCounts);
      const group = isGroupLayer(layer);
      if (group) groupCount += 1;
      else layerCount += 1;
      if (layer.hidden) hiddenLayerCount += 1;
      sourceNodeByKey.set(sourceKey, layer);
      const originalName = sanitizeName(
        layer.name,
        group ? `Group ${index + 1}` : `Layer ${index + 1}`
      );
      return {
        id: `preview:${sourceKey}`,
        sourceKey,
        kind: group ? "group" : "layer",
        originalName,
        displayName: originalName,
        autoRenamed: false,
        children: group ? buildNodes(layer.children ?? [], legacyTreeKey) : [],
      };
    });

  return {
    tree: applyDuplicateNames(buildNodes(psd.children ?? [], "root")),
    sourceNodeByKey,
    groupCount,
    layerCount,
    hiddenLayerCount,
  };
}

export async function preparePsdImportSource(
  source: PsdImportSource,
  token: string,
  parse: (file: File) => Promise<Psd> = parsePsdFile
) {
  const parsedPsd = await parse(source.file);
  const analysis = analyzeParsedPsd(parsedPsd);
  const prepared: PreparedPsdImport = {
    token,
    source,
    parsedPsd,
    sourceNodeByKey: analysis.sourceNodeByKey,
  };
  return {
    prepared,
    planEntry: {
      token,
      analysis: {
        fileName: source.file.name,
        width: parsedPsd.width,
        height: parsedPsd.height,
        groupCount: analysis.groupCount,
        layerCount: analysis.layerCount,
        hiddenLayerCount: analysis.hiddenLayerCount,
        warnings: [],
        conflict: null,
      },
      settings: createDefaultPsdImportSettings(source.file.name),
      tree: analysis.tree,
    },
  };
}
