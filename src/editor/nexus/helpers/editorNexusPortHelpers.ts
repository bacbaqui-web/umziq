import type {
  LayerDocumentNexusAction,
  LayerDocumentNexusState,
  LayerDocumentNexusTransitionResult,
} from "@/engines/project/models/layerDocumentNexusModel";
import type {
  EditorNexusPort,
} from "@/editor/nexus/models/editorNexusModel";

export function createEditorNexusPort(
  initialState: LayerDocumentNexusState,
  reduce: (
    state: LayerDocumentNexusState,
    action: LayerDocumentNexusAction
  ) => LayerDocumentNexusTransitionResult,
  publish: () => void = () => {}
): EditorNexusPort {
  let state = initialState;
  const transition = (action: LayerDocumentNexusAction) => {
    const result = reduce(state, action);
    if (result.ok && result.changed) {
      state = result.state;
      publish();
    }
    return result;
  };
  return {
    get state() {
      return state;
    },
    commitLayerTransaction: (transaction, selectTransformKeyframe) =>
      transition({
        kind: "commit-layer-transaction",
        transaction,
        ...(selectTransformKeyframe ? { selectTransformKeyframe } : {}),
      }),
    commitSourceTransaction: (transaction) =>
      transition({ kind: "commit-source-transaction", transaction }),
    commitCanvasSettings: (settings, label) =>
      transition({ kind: "commit-canvas-settings", settings, label }),
    replaceProject: (project) =>
      transition({ kind: "replace-project", project }),
    undo: () => transition({ kind: "undo" }),
    redo: () => transition({ kind: "redo" }),
    selectLayer: (selection) =>
      transition({ kind: "set-layer-selection", selection }),
    selectSource: (selection) =>
      transition({ kind: "set-source-selection", selection }),
    setActiveGroup: (layerDocumentId) =>
      transition({ kind: "set-active-group", layerDocumentId }),
    selectTransformKeyframe: (selection) =>
      transition({ kind: "set-transform-keyframe-selection", selection }),
    acknowledgeSourceStatus: (sourceId) =>
      transition({ kind: "acknowledge-source-status", sourceId }),
  };
}
