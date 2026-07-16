import type { Composition } from "@/models";
import type { PsdTreeNodeViewModel } from "@/engines/psd-tree/models/psdTreeModel";

function buildNode(
  composition: Composition,
  selectedCompId: string | null,
  depth: number
): PsdTreeNodeViewModel {
  const isMain = composition.type === "main";

  return {
    id: composition.id,
    type: composition.type,
    name: composition.name,
    depth,
    selected: composition.id === selectedCompId,
    sourceSyncStatus: composition.sourceSyncStatus ?? "normal",
    canRefresh: isMain,
    canDelete: isMain,
    canReorder: isMain,
    children: (composition.children ?? []).map((child) =>
      buildNode(child, selectedCompId, depth + 1)
    ),
  };
}

export function buildPsdTreeViewModel(
  rootCompositions: readonly Composition[],
  selectedCompId: string | null
) {
  return rootCompositions.map((composition) =>
    buildNode(composition, selectedCompId, 0)
  );
}
