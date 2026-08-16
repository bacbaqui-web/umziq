import {
  prepareLayerDocumentPsdRefresh,
} from "@/engines/project/import/layerDocumentPsdImportAdapter";
import {
  buildLayerDocumentSourceResourceCacheKey,
} from "@/render";
import type {
  LayerDocumentProjectLinkedSourcePreparationPort,
  PreparedLayerDocumentLinkedSourceRuntime,
} from "@/engines/project/models/layerDocumentProjectOpenModel";

export const
LAYER_DOCUMENT_PROJECT_LINKED_SOURCE_PREPARATION:
LayerDocumentProjectLinkedSourcePreparationPort = {
  prepare: async ({ project, source, file, bytes }) => {
    if (source.kind !== "psd-document") {
      return {
        ok: false,
        message:
          `Load runtime preparation is not implemented for ${source.kind}`,
      };
    }
    try {
      const existingSources = Object.values(
        project.payload.sourceRegistry.sourcesById
      );
      const prepared =
        await prepareLayerDocumentPsdRefresh({
          file,
          buffer: bytes?.slice().buffer,
          documentSource: source,
          existingSources,
        });
      const actualFingerprint =
        prepared.command.documentSource
          .contentFingerprint;
      const claim =
        prepared.runtime.claimForConfirm();
      if (!claim.ok) {
        return {
          ok: false,
          message:
            "PSD runtime preparation could not claim its resources",
        };
      }
      const savedSources =
        project.payload.sourceRegistry.sourcesById;
      const resources = claim.resources.flatMap(
        (resource) => {
          const saved = savedSources[resource.sourceId];
          if (saved?.kind !== "psd-node") {
            try {
              resource.dispose?.();
            } catch {
              // Ignore disposal failures for new, unsaved PSD nodes.
            }
            return [];
          }
          return [{
            ...resource,
            sourceResourceCacheKey:
              buildLayerDocumentSourceResourceCacheKey({
                sourceId: saved.sourceId,
                sourceKind: saved.kind,
                visualKeyPolicy:
                  "static-source-visual-revision",
                sourceVersion: saved.version,
                sourceFingerprint:
                  saved.data.visualFingerprint,
                localFrame: 0,
                sourceSamplingQuality: "source",
              }),
          }];
        }
      );
      const dependentIds = existingSources.flatMap(
        (candidate) =>
          candidate.kind === "psd-node" &&
          candidate.data.documentSourceId ===
            source.sourceId
            ? [candidate.sourceId]
            : []
      );
      const refreshedSourceIds = new Set(
        prepared.resolution.sourceIds
      );
      const available = new Set([
        source.sourceId,
        ...dependentIds.filter((sourceId) =>
          refreshedSourceIds.has(sourceId)
        ),
      ]);
      let ownership:
        "prepared" | "discarded" | "transferred" =
          "prepared";
      const dispose = () => {
        if (ownership !== "prepared") return 0;
        ownership = "discarded";
        resources.forEach((resource) => {
          try {
            resource.dispose?.();
          } catch {
            // Runtime cleanup remains best effort.
          }
        });
        return resources.length;
      };
      const value:
        PreparedLayerDocumentLinkedSourceRuntime = {
          contentFingerprint:
            actualFingerprint!,
          resources,
          availableSourceIds: [...available],
          unavailableSourceIds:
            dependentIds.filter(
              (sourceId) => !available.has(sourceId)
            ),
          discard: dispose,
          transfer: () => {
            if (ownership === "prepared") {
              ownership = "transferred";
            }
          },
        };
      return { ok: true, value };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Linked PSD runtime preparation failed",
      };
    }
  },
};
