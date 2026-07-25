import type {
  CreateLayerDocumentProjectOwnerOptions,
  LayerDocumentProjectOwnerPort,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import {
  createLayerDocumentProjectOwnerCompatibilityPort,
  useEditorProjectOwner,
} from "@/editor/project-owner";

/**
 * Temporary compatibility entry for existing Project Engine consumers.
 * New Editor code instantiates useEditorProjectOwner directly.
 */
export function useLayerDocumentProjectOwner(
  options: CreateLayerDocumentProjectOwnerOptions
): LayerDocumentProjectOwnerPort {
  return createLayerDocumentProjectOwnerCompatibilityPort(
    useEditorProjectOwner(options)
  );
}
