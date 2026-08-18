import type { LayerDocumentLibraryEngineOptions } from "@/engines/library/models/libraryEngineModel";
import { useLayerDocumentLibraryComposer } from "@/engines/library/composers/useLayerDocumentLibraryComposer";

export {
  buildLayerDocumentPsdImportViewPlan,
} from "@/engines/library/helpers/libraryPsdImportViewHelpers";
export {
  buildLayerDocumentLibraryNodes,
} from "@/engines/library/helpers/libraryTreeProjectionHelpers";

export function useLayerDocumentLibraryEngine(
  options: LayerDocumentLibraryEngineOptions
) {
  return useLayerDocumentLibraryComposer(options);
}
