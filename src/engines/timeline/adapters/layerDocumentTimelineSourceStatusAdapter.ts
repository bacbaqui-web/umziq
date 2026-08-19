import type {
  LayerDocumentTimelineSourceStatusPort,
  LayerDocumentTimelineNexusPort,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";

export type LayerDocumentTimelineSourceStatusResult =
  unknown;

/**
 * Resolves a Timeline Layer identity to its Source Registry reference. Source
 * reconciliation never dispatches a Layer subtree delete intent.
 */
export function createLayerDocumentTimelineSourceStatusAdapter(
  options: {
    nexus: LayerDocumentTimelineNexusPort;
  }
): LayerDocumentTimelineSourceStatusPort<
  LayerDocumentTimelineSourceStatusResult
> {
  const sourceForLayer = (
    layerDocumentId: string
  ) => {
    const project = options.nexus.project.read();
    const layer =
      project.payload.layerDocumentsById[
        layerDocumentId
      ];
    const sourceId =
      layer?.common.source?.sourceId;
    return sourceId
      ? project.payload.sourceRegistry.sourcesById[
          sourceId
        ] ?? null
      : null;
  };
  const acknowledge = (
    layerDocumentId: string
  ): LayerDocumentTimelineSourceStatusResult => {
    const source =
      sourceForLayer(layerDocumentId);
    if (!source) return null;
    return options.nexus.timeline
      .acknowledgeSourceStatus(
        source.sourceId
      );
  };
  return {
    acknowledge,
    resolve: (layerDocumentId, decision) => {
      const source =
        sourceForLayer(layerDocumentId);
      if (!source) return null;
      if (decision === "keep") {
        return acknowledge(layerDocumentId);
      }
      /*
       * Accepting an upstream deletion preserves the referenced Source
       * identity as missing. Raw Source deletion is forbidden while a Layer
       * references it, and Layer subtree deletion is a separate context
       * command.
       */
      options.nexus.runtime.resources.invalidate({
        kind: "source",
        sourceId: source.sourceId,
      });
      return options.nexus.runtime.resolutions.setMissing(
        source.sourceId
      );
    },
  };
}
