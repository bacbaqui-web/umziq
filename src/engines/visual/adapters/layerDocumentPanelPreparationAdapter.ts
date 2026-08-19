import {
  prepareLayerDocumentPointerMove,
  prepareLayerDocumentPointerUp,
} from "@/render";
import {
  prepareLayerDocumentPropertiesCommand,
} from "@/engines/visual/adapters/layerDocumentPropertiesCommandPreparationAdapter";
import {
  buildLayerDocumentPropertiesDescriptor,
} from "@/engines/visual/helpers/layerDocumentPropertiesDescriptorHelpers";
import type {
  LayerDocumentPanelPreparationPort,
} from "@/engines/visual/models/layerDocumentPanelModel";

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
