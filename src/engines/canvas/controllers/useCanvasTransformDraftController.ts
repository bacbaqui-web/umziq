import { useCallback, useRef } from "react";
import type { UseCanvasTransformControllerOptions } from "@/engines/canvas/models/canvasTransformControllerModel";
import {
  areDraftTransformSnapshotsSemanticallyEqual,
  resolveDraftTransformSnapshot,
  toPreviewSceneTransformPatch,
  type DraftTransformSnapshot,
} from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import type { PreviewSceneTransformPatch } from "@/engines/playback-render";

export function useCanvasTransformDraftController(
  options: UseCanvasTransformControllerOptions
) {
  const previousAcceptedSnapshotRef = useRef<DraftTransformSnapshot | null>(null);
  const updateTransform = useCallback(
    (
      patch: PreviewSceneTransformPatch,
      localFrame = options.selectedTransformLocalFrame
    ) => {
      const snapshot = resolveDraftTransformSnapshot({
        target: options.selectedTarget,
        localFrame,
        frameRate: options.selectedMeta?.frameRate,
        selectedMeta: options.selectedMeta,
        overlay: options.selectedOverlay,
        patch,
      });
      if (!snapshot) return null;
      if (areDraftTransformSnapshotsSemanticallyEqual(
        previousAcceptedSnapshotRef.current,
        snapshot
      )) return null;
      previousAcceptedSnapshotRef.current = snapshot;
      options.setDraftTransformSnapshot(snapshot);
      options.previewUpdates.updateTransform(
        snapshot.target,
        toPreviewSceneTransformPatch(snapshot)
      );
      return snapshot;
    },
    [options]
  );

  const reset = useCallback(() => {
    previousAcceptedSnapshotRef.current = null;
    options.setDraftTransformSnapshot(null);
    options.previewUpdates.reset();
  }, [options]);

  return { updateTransform, reset };
}
