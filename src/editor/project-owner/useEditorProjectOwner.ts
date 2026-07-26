import {
  useState,
} from "react";
import {
  createLayerDocumentProjectOwnerState,
  reduceLayerDocumentProjectOwner,
} from "@/engines/project/actions/layerDocumentProjectOwnerReducer";
import type {
  CreateLayerDocumentProjectOwnerOptions,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import {
  createEditorProjectOwnerPort,
} from "@/editor/project-owner/helpers/editorProjectOwnerPortHelpers";
import type {
  EditorProjectOwnerPort,
} from "@/editor/project-owner/models/editorProjectOwnerModel";

/**
 * The Editor instantiates one Project Owner. Reducers keep Project state,
 * replace, transactions, History and current Runtime session
 * in their existing small modules; lifecycle/persistence and Source Runtime
 * remain separately composed behind the Editor boundary.
 */
export function useEditorProjectOwner(
  options: CreateLayerDocumentProjectOwnerOptions
): EditorProjectOwnerPort {
  const [initialState] = useState(() => {
    const initialized =
      createLayerDocumentProjectOwnerState(options);
    if (!initialized.ok) {
      throw new Error(initialized.error.message);
    }
    return initialized.state;
  });
  const [, setRevision] = useState(0);
  const [owner] = useState(
    () => createEditorProjectOwnerPort(
      initialState,
      reduceLayerDocumentProjectOwner,
      () => setRevision(
        (revision) => revision + 1
      )
    )
  );
  return owner;
}
