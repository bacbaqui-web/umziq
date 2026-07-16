import { useProjectCommandController } from "@/engines/project/controllers/useProjectCommandController";

export type UseProjectCommandsOptions = Parameters<typeof useProjectCommandController>[0];

export function useProjectCommands(options: UseProjectCommandsOptions) {
  return useProjectCommandController(options);
}

export type ProjectCommands = ReturnType<typeof useProjectCommands>;
