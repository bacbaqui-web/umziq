import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  EvaluatedScene,
  PreviewScene,
  PreviewSceneTransformPatch,
  PreviewSceneUpdateTarget,
} from "@/engines/playback-render";
import {
  createDirtySceneSnapshotFromPreviewScene,
} from "@/engines/canvas/helpers/dirtyStateHelpers";
import {
  applyPreviewNodeCacheFromScenes,
} from "@/engines/canvas/helpers/nodeCacheHelpers";
import type { DirtyStateResource } from "@/engines/canvas/models/dirtyStateModel";
import { updatePreviewSceneNodeTransform } from "@/engines/playback-render";
import type { RuntimeMetricsResource } from "@/engines/canvas/models/runtimeMetricsModel";
import { createPreviewDraftBaseSceneResolver } from "@/engines/canvas/helpers/previewDraftBaseSceneHelpers";

export type PreviewUpdatePipelineCommands = {
  updateTransform: (
    target: PreviewSceneUpdateTarget | null,
    patch: PreviewSceneTransformPatch
  ) => void;
  reset: () => void;
};

export function usePreviewUpdatePipeline({
  previewScene,
  evaluatedScene,
  metrics,
  dirty,
}: {
  previewScene?: PreviewScene | null;
  evaluatedScene: EvaluatedScene | null;
  metrics?: RuntimeMetricsResource;
  dirty?: DirtyStateResource;
}): {
  previewScene: PreviewScene | null;
  isPreviewDraftActive: boolean;
  commands: PreviewUpdatePipelineCommands;
} {
  const basePreviewScene = previewScene ?? null;
  const draftBaseResolver = useMemo(
    () => createPreviewDraftBaseSceneResolver(evaluatedScene),
    [evaluatedScene]
  );
  const draftBaseToken = previewScene ?? draftBaseResolver;
  const [draft, setDraft] = useState<{
    base: PreviewScene | typeof draftBaseResolver | null;
    scene: PreviewScene | null;
    active: boolean;
  }>({ base: null, scene: null, active: false });
  const effectivePreviewScene = draft.active
    ? draft.scene
    : basePreviewScene;

  const recordDirtyMetrics = useCallback(
    (scene: PreviewScene | null) => {
      if (!dirty) return;
      const snapshot = dirty.updateDirtyState(
        createDirtySceneSnapshotFromPreviewScene(scene)
      );
      metrics?.increment("dirtyNode", snapshot.summary.dirtyNodeCount);
      metrics?.increment("frameDirty", snapshot.summary.frame);
    },
    [dirty, metrics]
  );

  const applyNodeCache = useCallback(
    (
      previousScene: PreviewScene | null,
      nextScene: PreviewScene | null
    ) => {
      const result = applyPreviewNodeCacheFromScenes(previousScene, nextScene);
      metrics?.increment("previewNodeUpdated", result.stats.updatedNodeCount);
      metrics?.increment("previewNodeReused", result.stats.reusedNodeCount);

      return result.scene;
    },
    [metrics]
  );

  useEffect(() => {
    recordDirtyMetrics(effectivePreviewScene);
  }, [effectivePreviewScene, recordDirtyMetrics]);

  const updateTransform = useCallback<
    PreviewUpdatePipelineCommands["updateTransform"]
  >((target, patch) => {
    if (!target) return;
    setDraft((current) => {
      const currentScene =
        current.active && current.base === draftBaseToken
          ? current.scene
          : previewScene ?? draftBaseResolver.resolve();

      const result = currentScene
        ? updatePreviewSceneNodeTransform(currentScene, target, patch)
        : currentScene;
      const scene = applyNodeCache(currentScene, result);
      metrics?.increment("previewUpdate");

      return {
        base: draftBaseToken,
        scene,
        active: scene !== null,
      };
    });
  }, [
    applyNodeCache,
    draftBaseResolver,
    draftBaseToken,
    metrics,
    previewScene,
  ]);

  const reset = useCallback(() => {
    setDraft({ base: draftBaseToken, scene: null, active: false });
  }, [draftBaseToken]);

  return {
    previewScene: effectivePreviewScene,
    isPreviewDraftActive: draft.active,
    commands: {
      updateTransform,
      reset,
    },
  };
}
