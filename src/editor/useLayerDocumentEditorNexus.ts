import {
  useState,
} from "react";
import {
  createInitialLayerDocumentNexusOptions,
} from "@/editor/layerDocumentEditorBootstrap";
import {
  useEditorNexus,
} from "@/editor/nexus";

/**
 * Owns the single live Editor Project port. The Editor root assembles Panel
 * Engines and the non-persistent Editor Runtime around this port.
 */
export function useLayerDocumentEditorNexus() {
  const [initialOptions] = useState(
    createInitialLayerDocumentNexusOptions
  );
  return useEditorNexus(initialOptions);
}
