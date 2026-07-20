import { useCallback } from "react";
import type { UseCanvasTransformControllerOptions } from "@/engines/canvas/models/canvasTransformControllerModel";
import {
  resolveDraftTransformSnapshot,
  toPreviewSceneTransformPatch,
} from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import type { PreviewSceneTransformPatch } from "@/engines/playback-render";

export function useCanvasTransformDraftController(
  options: UseCanvasTransformControllerOptions
) {
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
    options.setDraftTransformSnapshot(null);
    options.previewUpdates.reset();
  }, [options]);

  return { updateTransform, reset };
}
