import type { ProjectHistoryReadState, ProjectHistoryRestorePort } from "@/engines/project/history/projectHistorySnapshot";
import { useProjectHistoryController } from "@/engines/project/controllers/useProjectHistoryController";
import { useProjectHistoryState } from "@/engines/project/state/useProjectHistoryState";

export type UseProjectHistoryOptions = {
  readState: ProjectHistoryReadState;
  restorePort: ProjectHistoryRestorePort;
};

export function useProjectHistory(options: UseProjectHistoryOptions) {
  return useProjectHistoryController({
    historyRef: useProjectHistoryState(),
    readState: options.readState,
    restorePort: options.restorePort,
  });
}

export type ProjectHistory = ReturnType<typeof useProjectHistory>;
