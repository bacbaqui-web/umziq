import type {
  LayerDocumentProjectOwnerAction,
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
    get state() {
      return state;
    },
    transition: (action) => {
      const result = reduce(state, action);
      if (result.ok && result.changed) {
        state = result.state;
        publish();
      }
      return result;
    },
  };
}
