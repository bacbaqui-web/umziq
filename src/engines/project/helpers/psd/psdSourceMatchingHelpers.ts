import type { Composition, Layer } from "@/models";

export type PsdRefreshSourceMatches = {
  refreshedChildByExistingId: Map<string, Composition>;
  refreshedLayerByExistingId: Map<string, Layer>;
  matchedRefreshedChildIds: Set<string>;
  matchedRefreshedLayerIds: Set<string>;
};

function collectChildren(composition: Composition): Composition[] {
  return (composition.children ?? []).flatMap((child) => [child, ...collectChildren(child)]);
}

function collectLayers(composition: Composition): Layer[] {
  return [
    ...composition.layers,
    ...(composition.children ?? []).flatMap((child) => collectLayers(child)),
  ];
}

function buildUniqueValueMap<T>(
  items: readonly T[],
  getValue: (item: T) => string | undefined
) {
  const grouped = new Map<string, T[]>();
  items.forEach((item) => {
    const value = getValue(item);
    if (!value) return;
    grouped.set(value, [...(grouped.get(value) ?? []), item]);
  });
  return new Map(
    Array.from(grouped.entries())
      .filter(([, candidates]) => candidates.length === 1)
      .map(([value, [candidate]]) => [value, candidate])
  );
}

function getLegacySourceName(entity: Layer | Composition) {
  const pathName = entity.sourcePath?.split("/").at(-1) ?? entity.name;
  return pathName.replace(/_\d+$/, "");
}

function matchSourceEntities<T extends Layer | Composition>(
  existingItems: readonly T[],
  refreshedItems: readonly T[]
) {
  const refreshedByExistingId = new Map<string, T>();
  const claimedRefreshedIds = new Set<string>();

  const matchUnique = (
    getValue: (item: T) => string | undefined,
    canMatchExisting: (item: T) => boolean = () => true
  ) => {
    const remainingExisting = existingItems.filter(
      (item) => !refreshedByExistingId.has(item.id) && canMatchExisting(item)
    );
    const remainingRefreshed = refreshedItems.filter(
      (item) => !claimedRefreshedIds.has(item.id)
    );
    const existingByValue = buildUniqueValueMap(remainingExisting, getValue);
    const refreshedByValue = buildUniqueValueMap(remainingRefreshed, getValue);
    existingByValue.forEach((existing, value) => {
      const refreshed = refreshedByValue.get(value);
      if (!refreshed) return;
      refreshedByExistingId.set(existing.id, refreshed);
      claimedRefreshedIds.add(refreshed.id);
    });
  };

  matchUnique((item) => item.sourceIdentity?.sourceKey);
  const isLegacyExisting = (item: T) => !item.sourceIdentity;
  matchUnique((item) => item.sourcePath, isLegacyExisting);
  matchUnique((item) => item.sourceFingerprint, isLegacyExisting);
  matchUnique(getLegacySourceName, isLegacyExisting);

  return { refreshedByExistingId, claimedRefreshedIds };
}

export function buildPsdRefreshSourceMatches(
  existingMainComp: Composition,
  refreshedMainComp: Composition
): PsdRefreshSourceMatches {
  const childMatches = matchSourceEntities(
    collectChildren(existingMainComp),
    collectChildren(refreshedMainComp)
  );
  const layerMatches = matchSourceEntities(
    collectLayers(existingMainComp),
    collectLayers(refreshedMainComp)
  );

  return {
    refreshedChildByExistingId: childMatches.refreshedByExistingId,
    refreshedLayerByExistingId: layerMatches.refreshedByExistingId,
    matchedRefreshedChildIds: childMatches.claimedRefreshedIds,
    matchedRefreshedLayerIds: layerMatches.claimedRefreshedIds,
  };
}

export function buildLayerPathById(layers: Layer[]) {
  return new Map(
    layers
      .filter((layer): layer is Layer & { sourcePath: string } => !!layer.sourcePath)
      .map((layer) => [layer.id, layer.sourcePath])
  );
}

export function buildChildPathById(children: Composition[]) {
  return new Map(
    children
      .filter((child): child is Composition & { sourcePath: string } => !!child.sourcePath)
      .map((child) => [child.id, child.sourcePath])
  );
}

export function buildMergedEntityOrder<T extends { sourcePath?: string }>(
  existingItems: T[],
  refreshedItems: T[]
) {
  const existingSourcePaths = new Set(
    existingItems
      .map((item) => item.sourcePath)
      .filter((sourcePath): sourcePath is string => !!sourcePath)
  );

  return [
    ...existingItems,
    ...refreshedItems.filter(
      (item) => !!item.sourcePath && !existingSourcePaths.has(item.sourcePath)
    ),
  ];
}

export function collectCompositionIds(composition: Composition): string[] {
  return [
    composition.id,
    ...(composition.children?.flatMap((child) => collectCompositionIds(child)) ?? []),
  ];
}
