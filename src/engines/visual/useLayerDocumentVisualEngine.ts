import type {
  ModifierPropertiesControllerPort,
} from "@/engines/visual/controllers/modifierPropertiesController";
import {
  useLayerDocumentPropertiesComposer,
} from "@/engines/visual/composers/useLayerDocumentPropertiesComposer";
import type {
  LayerDocumentPropertiesCommandPort,
} from "@/engines/visual/models/propertiesControllerModel";

export {
  buildLayerDocumentPropertiesViewProps,
} from "@/engines/visual/composers/propertiesViewPropsComposer";
export type {
  PropertiesControllerSet as LayerDocumentPropertiesController,
} from "@/engines/visual/composers/propertiesViewPropsComposer";

export function useLayerDocumentVisualEngine(options: {
  port: LayerDocumentPropertiesCommandPort;
  formatTime?: (frame: number, frameRate: number) => string;
  frameRate?: number;
  resetRevision?: number;
  mouthBasic?: Pick<
    ModifierPropertiesControllerPort,
    "readProject" | "readDecodedAudio"
  >;
}) {
  return useLayerDocumentPropertiesComposer(options);
}
