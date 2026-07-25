import type { RenderCommand, RenderFrame } from "@/engines/playback-render";

function collectCommandSourceIds(
  commands: readonly RenderCommand[],
  sourceIds: Set<string>
): void {
  commands.forEach((command) => {
    if (command.type !== "composition") {
      if (command.sourceId) sourceIds.add(command.sourceId);
      return;
    }
    collectCommandSourceIds(command.children, sourceIds);
  });
}

export function collectRenderFrameSourceIds(
  frame: RenderFrame | null
): readonly string[] {
  if (!frame) return [];
  const sourceIds = new Set<string>();
  collectCommandSourceIds(frame.commands, sourceIds);
  return Array.from(sourceIds).sort();
}
