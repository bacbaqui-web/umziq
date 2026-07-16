import { useCallback } from "react";
import type { PsdTreeProjectCommandPort } from "@/engines/psd-tree/models/psdTreeModel";

type UseSourceActionControllerOptions = Pick<
  PsdTreeProjectCommandPort,
  "refreshMainComposition" | "removeMainComposition"
>;

export function useSourceActionController({
  refreshMainComposition,
  removeMainComposition,
}: UseSourceActionControllerOptions) {
  const requestRefresh = useCallback(
    async (compId: string) => refreshMainComposition(compId),
    [refreshMainComposition]
  );

  const refreshWithSource = useCallback(
    async (
      compId: string,
      source: Parameters<typeof refreshMainComposition>[1]
    ) => refreshMainComposition(compId, source),
    [refreshMainComposition]
  );

  const removeMain = useCallback(
    (compId: string) => removeMainComposition(compId),
    [removeMainComposition]
  );

  return { requestRefresh, refreshWithSource, removeMain };
}
