import type { EvaluatedScene, PreviewScene } from "@/engines/playback-render";
import { buildPreviewSceneFromEvaluatedScene } from "@/engines/playback-render";

export type PreviewDraftBaseSceneResolver = {
  resolve: () => PreviewScene | null;
};

export function createPreviewDraftBaseSceneResolver(
  evaluatedScene: EvaluatedScene | null,
  buildScene: (scene: EvaluatedScene) => PreviewScene =
    buildPreviewSceneFromEvaluatedScene
): PreviewDraftBaseSceneResolver {
  let didResolve = false;
  let resolvedScene: PreviewScene | null = null;

  return {
    resolve: () => {
      if (!didResolve) {
        didResolve = true;
        resolvedScene = evaluatedScene ? buildScene(evaluatedScene) : null;
      }
      return resolvedScene;
    },
  };
}
