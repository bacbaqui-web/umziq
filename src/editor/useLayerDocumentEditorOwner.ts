import {
  useState,
} from "react";
import {
  createInitialLayerDocumentOwnerOptions,
} from "@/editor/layerDocumentEditorBootstrap";
import {
  useEditorProjectOwner,
} from "@/editor/project-owner";

/**
 * Owns the single live Editor Project port. The Editor root assembles Panel
 * Engines and the non-persistent Editor Runtime around this port.
 */
export function useLayerDocumentEditorOwner() {
  const [initialOptions] = useState(
    createInitialLayerDocumentOwnerOptions
  );
  return useEditorProjectOwner(initialOptions);
}
