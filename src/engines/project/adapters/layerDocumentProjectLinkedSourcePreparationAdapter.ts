import {
  prepareLayerDocumentPsdRefresh,
} from "@/engines/project/import/layerDocumentPsdImportAdapter";
import {
  LAYER_DOCUMENT_BROWSER_AUDIO_DECODER,
  type LayerDocumentAudioDecodePort,
} from "@/engines/project/import/layerDocumentAudioImportAdapter";
import {
  buildLayerDocumentSourceResourceCacheKey,
} from "@/render";
import type {
  LayerDocumentProjectLinkedSourcePreparationPort,
  PreparedLayerDocumentLinkedSourceRuntime,
} from "@/engines/project/models/layerDocumentProjectOpenModel";

export function createLayerDocumentProjectLinkedSourcePreparation(options?: {
  readonly audioDecoder?: LayerDocumentAudioDecodePort;
}): LayerDocumentProjectLinkedSourcePreparationPort {
  return {
  prepare: async ({ project, source, input }) => {
    const file = new File(
      [input.bytes.slice().buffer],
      input.fileName
    );
    if (source.kind === "audio") {
      try {
        const buffer = input.bytes.slice().buffer;
        const [decoded, digest] = await Promise.all([
          (options?.audioDecoder ?? LAYER_DOCUMENT_BROWSER_AUDIO_DECODER)
            .decode(buffer),
          crypto.subtle.digest("SHA-256", buffer),
        ]);
        const contentFingerprint = {
          algorithm: "sha-256" as const,
          digestHex: Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join(""),
          byteLength: buffer.byteLength,
        };
        let ownership: "prepared" | "discarded" | "transferred" = "prepared";
        const audioResource = {
          sourceId: source.sourceId,
          fingerprint: contentFingerprint.digestHex,
          decodedAudio: decoded.decodedAudio,
          metadata: decoded.metadata,
          dispose: decoded.dispose,
        };
        return {
          ok: true,
          value: {
            contentFingerprint,
            resources: [],
            audioResources: [audioResource],
            availableSourceIds: [source.sourceId],
            unavailableSourceIds: [],
            discard: () => {
              if (ownership !== "prepared") return 0;
              ownership = "discarded";
              try { audioResource.dispose?.(); } catch { /* best effort */ }
              return 1;
            },
            transfer: () => {
              if (ownership === "prepared") ownership = "transferred";
            },
          },
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error
            ? error.message
            : "Linked Audio runtime preparation failed",
        };
      }
    }
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
          buffer: input.bytes.slice().buffer,
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
}

export const
LAYER_DOCUMENT_PROJECT_LINKED_SOURCE_PREPARATION =
  createLayerDocumentProjectLinkedSourcePreparation();
