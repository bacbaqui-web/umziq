import type {
  LayerDocumentPropertiesDescriptor,
  LayerDocumentPropertiesDescriptorResult,
} from "@/engines/properties/models/layerDocumentPropertiesModel";
import type {
  LayerDocumentPropertiesReadContext,
} from "@/engines/properties/models/propertiesControllerModel";

export type PropertiesSelectionKind = "none" | "visual" | "audio";

export function readyPropertiesDescriptor(
  result: LayerDocumentPropertiesDescriptorResult
): LayerDocumentPropertiesDescriptor | null {
  return result.status === "ready" ? result.descriptor : null;
}

export function resolvePropertiesSelectionKind(
  descriptor: LayerDocumentPropertiesDescriptor | null
): PropertiesSelectionKind {
  if (!descriptor) return "none";
  return descriptor.typeData.kind === "audio" ? "audio" : "visual";
}

export function buildPropertiesDraftScopeIdentity(
  context: LayerDocumentPropertiesReadContext,
  resetRevision?: number
) {
  const descriptor = readyPropertiesDescriptor(context.descriptor);
  return [
    descriptor?.layerDocumentId ?? "none",
    descriptor?.revision ?? "none",
    context.globalFrame,
    context.localFrame ?? "none",
    resetRevision ?? "none",
  ].join(":");
}
