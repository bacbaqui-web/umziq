import type {
  ModifierPropertiesControllerPort,
} from "@/engines/properties/controllers/modifierPropertiesController";
import {
  useLayerDocumentPropertiesComposer,
} from "@/engines/properties/composers/useLayerDocumentPropertiesComposer";
import type {
  LayerDocumentPropertiesCommandPort,
} from "@/engines/properties/models/propertiesControllerModel";

export {
  buildLayerDocumentPropertiesViewProps,
} from "@/engines/properties/composers/propertiesViewPropsComposer";
export type {
  PropertiesControllerSet as LayerDocumentPropertiesController,
} from "@/engines/properties/composers/propertiesViewPropsComposer";

export function useLayerDocumentPropertiesEngine(options: {
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
