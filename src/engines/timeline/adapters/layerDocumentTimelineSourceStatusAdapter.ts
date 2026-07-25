import type {
  SourceRegistryCacheInvalidationContext,
} from "@/engines/project";
import type {
  LayerDocumentTimelineSourceStatusPort,
  LayerDocumentTimelineOwnerPort,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";

export type LayerDocumentTimelineSourceStatusResult =
  unknown;

/**
 * Resolves a Timeline Layer identity to its Source Registry reference. Source
 * reconciliation never dispatches a Layer subtree delete intent.
 */
export function createLayerDocumentTimelineSourceStatusAdapter(
  options: {
    assembly: LayerDocumentTimelineOwnerPort;
    cacheContext: () =>
      SourceRegistryCacheInvalidationContext;
  }
): LayerDocumentTimelineSourceStatusPort<
  LayerDocumentTimelineSourceStatusResult
> {
  const sourceForLayer = (
    layerDocumentId: string
  ) => {
    const project = options.assembly.project.read();
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
    return options.assembly.timeline
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
      return options.assembly.sources.markMissing({
        sourceId: source.sourceId,
        reconnectHint: {
          fileName:
            "fileName" in source.data &&
            typeof source.data.fileName === "string"
              ? source.data.fileName
              : source.displayName,
          path: source.path,
        },
        cacheContext: options.cacheContext(),
      });
    },
  };
}
