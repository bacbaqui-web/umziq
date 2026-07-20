import type { Composition } from "@/models";
import type { PsdTreeNodeViewModel } from "@/engines/psd-tree/models/psdTreeModel";
import type { PsdRefreshSummary } from "@/engines/project";

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

export function buildPsdRefreshSummaryViewModel(summary: PsdRefreshSummary) {
  const hasChanges =
    summary.newGroups +
      summary.newLayers +
      summary.updated +
      summary.missing +
      summary.deletePending >
    0;

  return {
    compositionName: summary.compositionName,
    hasChanges,
    problematic: summary.problematic,
    items: [
      { label: "새 그룹", value: summary.newGroups, problem: false },
      { label: "새 레이어", value: summary.newLayers, problem: false },
      { label: "업데이트", value: summary.updated, problem: false },
      { label: "누락", value: summary.missing, problem: false },
      { label: "삭제 대기", value: summary.deletePending, problem: false },
      { label: "문제", value: summary.problematic, problem: true },
    ],
  };
}
