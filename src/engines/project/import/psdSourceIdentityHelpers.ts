import type { Layer as PsdLayer } from "ag-psd";
import type { PsdSourceIdentity } from "@/models";

export function countPsdLayerIds(layers: readonly PsdLayer[]) {
  const counts = new Map<number, number>();
  const visit = (items: readonly PsdLayer[]) => {
    items.forEach((layer) => {
      if (Number.isInteger(layer.id)) {
        counts.set(layer.id as number, (counts.get(layer.id as number) ?? 0) + 1);
      }
      visit(layer.children ?? []);
    });
  };
  visit(layers);
  return counts;
}

export function buildPsdSourceKey(
  layer: PsdLayer,
  legacyTreeKey: string,
  layerIdCounts: ReadonlyMap<number, number>
) {
  return Number.isInteger(layer.id) && layerIdCounts.get(layer.id as number) === 1
    ? `layer-id:${layer.id}`
    : `legacy-tree:${legacyTreeKey}`;
}

export function createPsdSourceIdentity(
  sourceFileName: string,
  sourceKey: string
): PsdSourceIdentity {
  return { sourceFileName, sourceKey };
}
