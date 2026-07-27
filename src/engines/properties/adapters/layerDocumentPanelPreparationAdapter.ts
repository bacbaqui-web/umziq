import {
  prepareLayerDocumentPointerMove,
  prepareLayerDocumentPointerUp,
} from "@/render";
import {
  prepareLayerDocumentPanelCommand,
} from "@/engines/properties/adapters/layerDocumentPanelCommandAdapter";
import {
  buildLayerDocumentPanelDescriptor,
} from "@/engines/properties/helpers/layerDocumentPanelDescriptorHelpers";
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
    describe: buildLayerDocumentPanelDescriptor,
  },
  commands: {
    prepare: prepareLayerDocumentPanelCommand,
  },
  draft: {
    preparePointerMove: prepareLayerDocumentPointerMove,
    preparePointerUp: prepareLayerDocumentPointerUp,
  },
};
