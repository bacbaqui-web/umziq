import type {
  LayerDocumentProjectOwnerEffect,
} from "@/engines/project";
import type {
  LayerDocumentConsumerCutoverInput,
} from "@/cutover/layerDocumentConsumerCutoverModel";

export function applyLayerDocumentRuntimeCacheEffect(
  input: LayerDocumentConsumerCutoverInput,
  effect: LayerDocumentProjectOwnerEffect
) {
  if (effect.runtimeCachePolicy === "invalidate-all") {
    input.sourceRuntime.invalidate({ kind: "all" });
    return;
  }
  if (
    effect.runtimeCachePolicy !==
    "apply-source-invalidations"
  ) return;
  effect.sourceRestorationIds.forEach((sourceId) => {
    input.sourceRuntime.restoreSource(sourceId);
  });
  effect.sourceDisposalIds.forEach((sourceId) => {
    input.sourceRuntime.invalidate({
      kind: "source",
      sourceId,
    });
  });
  effect.suspendedSourceDisposalIds.forEach((sourceId) => {
    input.sourceRuntime.disposeSuspendedSource(sourceId);
  });
  effect.sourceInvalidationIds.forEach((sourceId) => {
    input.sourceRuntime.suspendSource(sourceId);
  });
  const invalidatedKeys = new Set<string>();
  effect.cacheInvalidations.forEach((descriptor) => {
    const key = JSON.stringify([
      descriptor.sourceId,
      descriptor.sourceResourceCacheKeyBefore,
    ]);
    if (invalidatedKeys.has(key)) return;
    invalidatedKeys.add(key);
    input.sourceRuntime.invalidate({
      kind: "cache-key",
      sourceId: descriptor.sourceId,
      sourceResourceCacheKey:
        descriptor.sourceResourceCacheKeyBefore,
    });
  });
}
