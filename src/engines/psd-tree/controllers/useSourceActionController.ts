import { useCallback } from "react";
import type { PsdTreeProjectCommandPort } from "@/engines/psd-tree/models/psdTreeModel";
import type { PsdTreeState } from "@/engines/psd-tree/state/usePsdTreeState";

type UseSourceActionControllerOptions = Pick<
  PsdTreeProjectCommandPort,
  "refreshMainComposition" | "removeMainComposition"
>;

type Options = UseSourceActionControllerOptions & {
  state: Pick<PsdTreeState, "setRefreshSummary">;
};

export function useSourceActionController({
  refreshMainComposition,
  removeMainComposition,
  state,
}: Options) {
  const runRefresh = useCallback(
    async (
      compId: string,
      source?: Parameters<typeof refreshMainComposition>[1]
    ) => {
      state.setRefreshSummary(null);
      const result = await refreshMainComposition(compId, source);
      if (result.status === "completed" && result.summary) {
        state.setRefreshSummary(result.summary);
      }
      return result.status;
    },
    [refreshMainComposition, state]
  );

  const requestRefresh = useCallback(
    async (compId: string) => runRefresh(compId),
    [runRefresh]
  );

  const refreshWithSource = useCallback(
    async (
      compId: string,
      source: Parameters<typeof refreshMainComposition>[1]
    ) => runRefresh(compId, source),
    [runRefresh]
  );

  const removeMain = useCallback(
    (compId: string) => {
      state.setRefreshSummary(null);
      removeMainComposition(compId);
    },
    [removeMainComposition, state]
  );

  return { requestRefresh, refreshWithSource, removeMain };
}
