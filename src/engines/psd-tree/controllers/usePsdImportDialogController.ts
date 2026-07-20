import { useCallback, useRef } from "react";
import type { PsdImportPlan } from "@/engines/project";
import { movePsdImportPlanNode } from "@/engines/psd-tree/helpers/psdImportPlanTreeHelpers";
import type { PsdTreeProjectCommandPort } from "@/engines/psd-tree/models/psdTreeModel";
import type { PsdTreeState } from "@/engines/psd-tree/state/usePsdTreeState";

type Options = {
  project: Pick<
    PsdTreeProjectCommandPort,
    "preparePsdImport" | "confirmPsdImport" | "cancelPsdImport"
  >;
  state: PsdTreeState;
};

export function usePsdImportDialogController({ project, state }: Options) {
  const preparationSequenceRef = useRef(0);
  const prepare = useCallback(
    async (sources: Parameters<PsdTreeProjectCommandPort["preparePsdImport"]>[0]) => {
      preparationSequenceRef.current += 1;
      const sequence = preparationSequenceRef.current;
      state.setImportPreviewStatus("analyzing");
      state.setImportPreviewError(null);
      const plan = await project.preparePsdImport(sources);
      if (sequence !== preparationSequenceRef.current) {
        project.cancelPsdImport(plan);
        return;
      }
      if (plan.entries.length === 0) {
        state.setImportPreviewStatus("idle");
        state.setImportPreviewError("분석할 수 있는 PSD가 없습니다.");
        return;
      }
      state.setImportPlan(plan);
      state.setImportPreviewStatus("review");
    },
    [project, state]
  );

  const cancel = useCallback(() => {
    preparationSequenceRef.current += 1;
    if (state.importPlan) project.cancelPsdImport(state.importPlan);
    state.setImportPlan(null);
    state.setImportPreviewStatus("idle");
    state.setImportPreviewError(null);
  }, [project, state]);

  const confirm = useCallback(async () => {
    if (!state.importPlan) return;
    state.setImportPreviewStatus("importing");
    const result = await project.confirmPsdImport(state.importPlan);
    if (result.importedCount === 0) {
      state.setImportPlan(null);
      state.setImportPreviewStatus("idle");
      return;
    }
    state.setImportPlan(null);
    state.setImportPreviewStatus("idle");
    state.setImportPreviewError(null);
  }, [project, state]);

  const moveNode = useCallback(
    (
      token: string,
      draggedId: string,
      targetId: string | null,
      position: "before" | "inside" | "after"
    ) => {
      state.setImportPlan((current: PsdImportPlan | null) => {
        if (!current) return current;
        return {
          entries: current.entries.map((entry) =>
            entry.token === token
              ? { ...entry, tree: movePsdImportPlanNode(entry.tree, draggedId, targetId, position) }
              : entry
          ),
        };
      });
    },
    [state]
  );

  return { prepare, cancel, confirm, moveNode };
}
