import type {
  LayerDocumentProjectOwnerAction,
  LayerDocumentProjectOwnerState,
  LayerDocumentProjectOwnerTransitionResult,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";

/**
 * Editor-owned Project boundary.
 *
 * Commands return their Runtime effect in the successful transition result;
 * consumers apply that effect through injected Runtime ports. Panel Runtime
 * is deliberately not part of this boundary.
 */
export interface EditorProjectOwnerPort {
  readonly read: () => LayerDocumentProjectOwnerState;
  readonly command: (
    action: LayerDocumentProjectOwnerAction
  ) => LayerDocumentProjectOwnerTransitionResult;
}
