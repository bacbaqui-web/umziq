import type { LayerDocumentLibraryController } from "@/engines/project";
import type { LibraryAudioCommandPort } from "@/engines/library/models/libraryEngineModel";
import type { LibraryNodeViewModel } from "@/engines/library/models/libraryModel";
import { findLibraryNode } from "@/engines/library/helpers/libraryTreeProjectionHelpers";

export function createLibraryNodeCommandController(options: {
  controller: LayerDocumentLibraryController;
  audio: LibraryAudioCommandPort;
  nodes: readonly LibraryNodeViewModel[];
  beginRefresh: (sourceId: string) => void;
  duplicate: (layerDocumentId: string) => boolean;
  convertToDrawing: (layerDocumentId: string) => boolean;
}) {
  const find = (nodeId: string) => findLibraryNode(options.nodes, nodeId);
  return {
    select: (nodeId: string) => {
      const node = find(nodeId);
      if (node?.type === "project") {
        options.controller.openProject();
      } else if (
        node?.selected &&
        node.entityKind !== "composition" &&
        node.layerDocumentId
      ) {
        options.controller.selectLayerDocument(null);
      } else if (node?.contentKind === "audio" && node.layerDocumentId) {
        options.audio.select(node.layerDocumentId);
      } else if (node?.type === "main" && node.sourceId) {
        options.controller.selectSource(node.sourceId);
      } else if (node?.layerDocumentId) {
        options.controller.selectLayerDocument(node.layerDocumentId);
      }
    },
    selectForContextMenu: (nodeId: string) => {
      const node = find(nodeId);
      if (!node?.layerDocumentId) return;
      if (node.contentKind === "audio") {
        options.audio.select(node.layerDocumentId);
      } else {
        options.controller.selectLayerDocument(node.layerDocumentId);
      }
    },
    toggleVisibility: (nodeId: string) => {
      const node = find(nodeId);
      if (node?.contentKind === "audio") {
        options.audio.toggleMuted(nodeId);
      } else if (node?.layerDocumentId) {
        options.controller.toggleLayerVisibility(node.layerDocumentId);
      }
    },
    toggleLock: (nodeId: string) => {
      const node = find(nodeId);
      if (node?.layerDocumentId) {
        options.controller.toggleLayerLock(node.layerDocumentId);
      }
    },
    togglePlayback: options.audio.togglePlayback,
    rename: (nodeId: string, name: string) => {
      const node = find(nodeId);
      if (node?.contentKind === "audio") {
        options.audio.rename(nodeId, name);
      } else if (node?.layerDocumentId) {
        options.controller.renameLayerDocument(node.layerDocumentId, name);
      }
    },
    delete: (nodeId: string) => {
      const node = find(nodeId);
      if (node?.contentKind === "audio") {
        options.audio.delete(nodeId);
      } else if (node?.layerDocumentId) {
        options.controller.deleteLayerDocument(node.layerDocumentId);
      }
    },
    duplicate: (nodeId: string) => {
      const node = find(nodeId);
      if (node?.layerDocumentId) options.duplicate(node.layerDocumentId);
    },
    convertToDrawing: (nodeId: string) => {
      const node = find(nodeId);
      if (node?.layerDocumentId && node.contentKind === "visual" && node.entityKind === "layer") {
        options.convertToDrawing(node.layerDocumentId);
      }
    },
    refresh: options.beginRefresh,
    deleteSource: (sourceId: string) => {
      options.controller.deleteSource({ sourceId });
    },
  };
}
