import type { Composition, Layer } from "@/models";

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
