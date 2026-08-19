import {
  useState,
} from "react";
import {
  createLayerDocumentNexusState,
  reduceLayerDocumentNexus,
} from "@/engines/project/actions/layerDocumentNexusReducer";
import type {
  CreateLayerDocumentNexusOptions,
} from "@/engines/project/models/layerDocumentNexusModel";
import {
  createEditorNexusPort,
} from "@/editor/nexus/helpers/editorNexusPortHelpers";
import type {
  EditorNexusPort,
} from "@/editor/nexus/models/editorNexusModel";

/**
 * The Editor instantiates one Project Nexus. Reducers keep Project state,
 * replace, transactions, History and current Runtime session
 * in their existing small modules; lifecycle/persistence and Source Runtime
 * remain separately composed behind the Editor boundary.
 */
export function useEditorNexus(
  options: CreateLayerDocumentNexusOptions
): EditorNexusPort {
  const [initialState] = useState(() => {
    const initialized =
      createLayerDocumentNexusState(options);
    if (!initialized.ok) {
      throw new Error(initialized.error.message);
    }
    return initialized.state;
  });
  const [, setRevision] = useState(0);
  const [nexus] = useState(
    () => createEditorNexusPort(
      initialState,
      reduceLayerDocumentNexus,
      () => setRevision(
        (revision) => revision + 1
      )
    )
  );
  return nexus;
}
