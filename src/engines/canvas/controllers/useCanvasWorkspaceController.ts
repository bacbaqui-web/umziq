import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import { observeCanvasWorkspace } from "@/engines/canvas/adapters/canvasWorkspaceAdapter";
import type { CanvasSize } from "@/engines/canvas/models/canvasEngineModel";

export function useCanvasWorkspaceController({
  workspaceRef,
  setWorkspaceSize,
}: {
  workspaceRef: RefObject<HTMLDivElement | null>;
  setWorkspaceSize: Dispatch<SetStateAction<CanvasSize>>;
}) {
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    return observeCanvasWorkspace(workspace, (nextSize) => {
      setWorkspaceSize((current) =>
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize
      );
    });
  }, [setWorkspaceSize, workspaceRef]);
}
