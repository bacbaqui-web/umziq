import type {
  LayerDocumentProjectOwnerAction,
  LayerDocumentProjectOwnerPort,
  LayerDocumentProjectOwnerState,
  LayerDocumentProjectOwnerTransitionResult,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import type {
  EditorProjectOwnerPort,
} from "@/editor/project-owner/models/editorProjectOwnerModel";

export function createEditorProjectOwnerPort(
  initialState: LayerDocumentProjectOwnerState,
  reduce: (
    state: LayerDocumentProjectOwnerState,
    action: LayerDocumentProjectOwnerAction
  ) => LayerDocumentProjectOwnerTransitionResult,
  publish: () => void = () => {}
): EditorProjectOwnerPort {
  let state = initialState;
  return {
    read: () => state,
    command: (action) => {
      const result = reduce(state, action);
      if (result.ok && result.changed) {
        state = result.state;
        publish();
      }
      return result;
    },
  };
}

/**
 * Temporary A3 compatibility for Project Engine/cutover consumers.
 * The adapter owns no state and delegates to the Editor Project Owner.
 */
export function createLayerDocumentProjectOwnerCompatibilityPort(
  owner: EditorProjectOwnerPort
): LayerDocumentProjectOwnerPort {
  return {
    get state() {
      return owner.read();
    },
    transition: owner.command,
  };
}
