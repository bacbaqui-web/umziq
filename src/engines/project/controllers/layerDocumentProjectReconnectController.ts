import type {
  SourceRegistryRecord,
} from "@/models";
import type {
  CreateLayerDocumentProjectReconnectControllerOptions,
  LayerDocumentProjectReconnectController,
  LayerDocumentProjectReconnectResult,
} from "@/engines/project/models/layerDocumentProjectReconnectModel";

function isLinkedDocument(
  source: SourceRegistryRecord
): source is Extract<
  SourceRegistryRecord,
  {
    kind: "psd-document" | "audio" | "video";
  }
> {
  return (
    source.kind === "psd-document" ||
    source.kind === "audio" ||
    source.kind === "video"
  );
}

function dependentSourceIds(
  source: Extract<
    SourceRegistryRecord,
    {
      kind: "psd-document" | "audio" | "video";
    }
  >,
  sources: readonly SourceRegistryRecord[]
) {
  return source.kind === "psd-document"
    ? [
        source.sourceId,
        ...sources.flatMap((candidate) =>
          candidate.kind === "psd-node" &&
          candidate.data.documentSourceId ===
            source.sourceId
            ? [candidate.sourceId]
            : []
        ),
      ]
    : [source.sourceId];
}

function fingerprintsMatch(
  left: {
    readonly digestHex: string;
    readonly byteLength: number;
  },
  right: {
    readonly digestHex: string;
    readonly byteLength: number;
  }
) {
  return (
    left.digestHex === right.digestHex &&
    left.byteLength === right.byteLength
  );
}

function staleResult():
LayerDocumentProjectReconnectResult {
  return {
    ok: false,
    error: {
      code: "stale-operation",
      message:
        "A newer reconnect superseded this result",
    },
  };
}

export function createLayerDocumentProjectReconnectController(
  options:
    CreateLayerDocumentProjectReconnectControllerOptions
): LayerDocumentProjectReconnectController {
  let sequence = 0;
  return {
    read: () => {
      const project = options.readProject();
      const sources = Object.values(
        project.payload.sourceRegistry.sourcesById
      );
      const items = sources.flatMap((source) => {
        if (!isLinkedDocument(source)) return [];
        const resolution =
          options.sourceResolution.read(
            source.sourceId
          );
        if (
          resolution.status !== "missing" &&
          resolution.status !== "error"
        ) return [];
        const dependentIds =
          dependentSourceIds(source, sources);
        const dependentSet =
          new Set(dependentIds);
        return [{
          sourceId: source.sourceId,
          displayName: source.displayName,
          suggestedFileName:
            source.locator.suggestedFileName,
          status: resolution.status,
          fingerprintPolicy:
            source.contentFingerprint
              ? "verified" as const
              : "legacy-unverified" as const,
          dependentSourceIds: dependentIds,
          dependentLayerDocumentIds:
            Object.values(
              project.payload.layerDocumentsById
            ).flatMap((layer) =>
              layer.common.source &&
              dependentSet.has(
                layer.common.source.sourceId
              )
                ? [layer.layerDocumentId]
                : []
            ),
        }];
      });
      return {
        items: items.sort((left, right) =>
          left.displayName.localeCompare(
            right.displayName
          )
        ),
      };
    },
    reconnect: async (sourceId) => {
      sequence += 1;
      const token = sequence;
      const project = options.readProject();
      const source =
        project.payload.sourceRegistry
          .sourcesById[sourceId];
      if (!source) {
        return {
          ok: false,
          error: {
            code: "source-not-found",
            message:
              `Source not found: ${sourceId}`,
          },
        };
      }
      if (!isLinkedDocument(source)) {
        return {
          ok: false,
          error: {
            code: "source-not-linked-document",
            message:
              "Reconnect requires a linked document Source",
          },
        };
      }
      const sources = Object.values(
        project.payload.sourceRegistry.sourcesById
      );
      const dependentIds =
        dependentSourceIds(source, sources);
      const isCurrent = () =>
        token === sequence &&
        options.readProject() === project;
      const selected =
        await options.browser
          .chooseLinkedSourceFile(source);
      if (!isCurrent()) return staleResult();
      if (!selected.ok) return selected;
      const prepared =
        await options.preparation.prepare({
          project,
          source,
          file: selected.value.file,
          bytes: selected.value.bytes,
        });
      if (!isCurrent()) {
        if (prepared.ok) prepared.value.discard();
        return staleResult();
      }
      if (!prepared.ok) {
        dependentIds.forEach((id) =>
          options.sourceResolution.setError(
            id,
            prepared.message
          )
        );
        return {
          ok: false,
          error: {
            code: "parse-failed",
            message: prepared.message,
          },
        };
      }
      const expected =
        source.contentFingerprint;
      const actual =
        prepared.value.contentFingerprint;
      if (
        !expected ||
        !fingerprintsMatch(expected, actual)
      ) {
        prepared.value.discard();
        return {
          ok: true,
          status: "confirmation-required",
          sourceId,
          reason: expected
            ? "fingerprint-mismatch"
            : "legacy-unverified-fingerprint",
          expectedFingerprint: expected,
          actualFingerprint: actual,
          choices: [
            "refresh-source",
            "replace-source",
          ],
        };
      }
      const preflight =
        options.sourceRuntime.preflightBatch(
          prepared.value.resources
        );
      const audioResources = prepared.value.audioResources ?? [];
      const audioPreflight = audioResources.length === 0
        ? { ok: true as const }
        : options.audioRuntime?.preflight(audioResources) ?? {
            ok: false as const,
            message: "Audio runtime is unavailable",
          };
      if (!preflight.ok || !audioPreflight.ok) {
        prepared.value.discard();
        const message = preflight.ok
          ? audioPreflight.ok ? "Runtime registration failed" : audioPreflight.message
          : preflight.message;
        dependentIds.forEach((id) =>
          options.sourceResolution.setError(
            id,
            message
          )
        );
        return {
          ok: false,
          error: {
            code:
              "runtime-registration-failed",
            message,
          },
        };
      }
      dependentIds.forEach((id) =>
        options.sourceRuntime.suspendSource(id)
      );
      const registered =
        options.sourceRuntime.registerBatch(
          prepared.value.resources
        );
      if (!registered.ok) {
        dependentIds.forEach((id) =>
          options.sourceRuntime.restoreSource(id)
        );
        prepared.value.discard();
        dependentIds.forEach((id) =>
          options.sourceResolution.setError(
            id,
            registered.message
          )
        );
        return {
          ok: false,
          error: {
            code:
              "runtime-registration-failed",
            message: registered.message,
          },
        };
      }
      dependentIds.forEach((id) =>
        options.sourceRuntime
          .disposeSuspendedSource(id)
      );
      if (audioResources.length > 0) {
        const audioRegistered =
          options.audioRuntime!.register(audioResources);
        if (!audioRegistered.ok) {
          prepared.value.discard();
          dependentIds.forEach((id) =>
            options.sourceResolution.setError(
              id,
              audioRegistered.message
            )
          );
          return {
            ok: false,
            error: {
              code: "runtime-registration-failed",
              message: audioRegistered.message,
            },
          };
        }
      }
      prepared.value.transfer();
      const available = new Set(
        prepared.value.availableSourceIds
      );
      prepared.value.availableSourceIds.forEach(
        (id) =>
          options.sourceResolution.setAvailable({
            sourceId: id,
            file: selected.value.file,
            handle:
              selected.value.handle as unknown as
                FileSystemFileHandle | null,
            permission:
              selected.value.handle
                ? "granted"
                : "unknown",
          })
      );
      const missing = new Set(
        prepared.value.unavailableSourceIds
      );
      dependentIds.forEach((id) => {
        if (!available.has(id)) missing.add(id);
      });
      missing.forEach((id) =>
        options.sourceResolution.setMissing(id)
      );
      options.localHandles.update({
        projectId: project.metadata.projectId,
        locatorId: source.locator.locatorId,
        file: selected.value.file,
        handle:
          selected.value.handle as unknown as
            FileSystemFileHandle | null,
        permission:
          selected.value.handle
            ? "granted"
            : "unknown",
      });
      return {
        ok: true,
        status: "reconnected",
        sourceId,
        availableSourceIds:
          [...available].sort(),
        missingSourceIds: [...missing].sort(),
      };
    },
  };
}
