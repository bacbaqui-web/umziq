import type {
  LayerDocumentProjectOwnerPort,
  LayerDocumentProjectOwnerState,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";

export interface LayerDocumentProjectOwnerStateRef {
  current: LayerDocumentProjectOwnerState;
}

/**
 * The state property is deliberately a live getter. Commands in the same
 * event turn can prepare against the state written by the prior transition
 * without waiting for React to render again.
 */
export function createLayerDocumentProjectOwnerLivePort(
  stateRef: LayerDocumentProjectOwnerStateRef,
  transition: LayerDocumentProjectOwnerPort["transition"]
): LayerDocumentProjectOwnerPort {
  return {
    get state() {
      return stateRef.current;
    },
    transition,
  };
}
