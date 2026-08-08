import {
  prepareLayerDocumentPointerMove,
  prepareLayerDocumentPointerUp,
} from "@/render";
import {
  prepareLayerDocumentPropertiesCommand,
} from "@/engines/properties/adapters/layerDocumentPropertiesCommandPreparationAdapter";
import {
  buildLayerDocumentPropertiesDescriptor,
} from "@/engines/properties/helpers/layerDocumentPropertiesDescriptorHelpers";
import type {
  LayerDocumentPanelPreparationPort,
} from "@/engines/properties/models/layerDocumentPanelModel";

/**
 * Task 9 preparation only. This port owns no Project copy, Draft, State,
 * Runtime, commit callback, History callback, selection, or refresh effect.
 */
export const LAYER_DOCUMENT_PANEL_PREPARATION_PORT:
LayerDocumentPanelPreparationPort = {
  query: {
    describe: buildLayerDocumentPropertiesDescriptor,
  },
  commands: {
    prepare: prepareLayerDocumentPropertiesCommand,
  },
  draft: {
    preparePointerMove: prepareLayerDocumentPointerMove,
    preparePointerUp: prepareLayerDocumentPointerUp,
  },
};
