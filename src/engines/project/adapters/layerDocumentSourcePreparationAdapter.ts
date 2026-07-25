import {
  preparePsdSourceNodeDiscovery,
  preparePsdSourceRegistryRefresh,
  prepareSourceRegistryDelete,
  prepareSourceRegistryImport,
  prepareSourceRegistryMissing,
  prepareSourceRegistryReconnect,
  prepareSourceRegistryRefresh,
} from "@/engines/project/actions/layerDocumentSourceTransactions";
import {
  buildPsdSourceTreeReadModel,
} from "@/engines/project/helpers/layerDocumentSourceTreeHelpers";
import type {
  LayerDocumentSourcePreparationPort,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";

/**
 * Task 9 preparation only. The port returns unapplied Plain Data
 * transactions and explicit History policy. It owns no Project State,
 * History, Runtime resource, decoder, FileHandle, bitmap, or Canvas.
 */
export const LAYER_DOCUMENT_SOURCE_PREPARATION_PORT:
LayerDocumentSourcePreparationPort = {
  query: {
    readTree: buildPsdSourceTreeReadModel,
  },
  commands: {
    prepareImport: prepareSourceRegistryImport,
    prepareRefresh: prepareSourceRegistryRefresh,
    preparePsdRefresh: preparePsdSourceRegistryRefresh,
    prepareMissing: prepareSourceRegistryMissing,
    prepareReconnect: prepareSourceRegistryReconnect,
    prepareDiscovery: preparePsdSourceNodeDiscovery,
    prepareDelete: prepareSourceRegistryDelete,
  },
};
