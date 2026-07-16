import { useCallback } from "react";
import type { PsdTreeSelectionPort } from "@/engines/psd-tree/models/psdTreeModel";

export function useTreeSelectionController(selection: PsdTreeSelectionPort) {
  const selectNode = useCallback(
    (nodeId: string) => {
      selection.selectComposition(nodeId);
    },
    [selection]
  );

  return { selectNode };
}
