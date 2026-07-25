import {
  loadLayerDocumentProjectFromSfep,
} from "@/engines/project/adapters/layerDocumentProjectPersistenceCodec";
import type {
  CreateLayerDocumentProjectOpenControllerOptions,
  LayerDocumentProjectOpenController,
  LayerDocumentProjectOpenResult,
  PreparedLayerDocumentLinkedSourceRuntime,
} from "@/engines/project/models/layerDocumentProjectOpenModel";
import type {
  LayerDocumentProjectOperationToken,
} from "@/engines/project/models/layerDocumentProjectLifecycleModel";
import type {
  SourceRegistryRecord,
} from "@/models";

function activeTokenMatches(
  options:
    CreateLayerDocumentProjectOpenControllerOptions,
  token: LayerDocumentProjectOperationToken
) {
  const active =
    options.lifecycle.read().operationToken;
  return (
    active?.sequence === token.sequence &&
    active.operation === token.operation
  );
}

function staleResult():
LayerDocumentProjectOpenResult {
  return {
    ok: false,
    error: {
      code: "stale-operation",
      message:
        "A newer Project operation superseded this load",
    },
  };
}

function linkedDocumentSources(
  sources: readonly SourceRegistryRecord[]
) {
  return sources.filter(
    (source) =>
      source.kind === "psd-document" ||
      source.kind === "audio" ||
      source.kind === "video"
  );
}

function dependentSourceIds(
  source: SourceRegistryRecord,
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
  expected:
    | {
        readonly digestHex: string;
        readonly byteLength: number;
      }
    | null,
  actual: {
    readonly digestHex: string;
    readonly byteLength: number;
  }
) {
  return (
    expected !== null &&
    expected.digestHex === actual.digestHex &&
    expected.byteLength === actual.byteLength
  );
}

export function createLayerDocumentProjectOpenController(
  options:
    CreateLayerDocumentProjectOpenControllerOptions
): LayerDocumentProjectOpenController {
  return {
    open: async () => {
      const token =
        options.lifecycle.beginOperation("loading");
      const selected =
        await options.browser.chooseProjectFile();
      if (!selected.ok) {
        options.lifecycle.finishOperation(token);
        return selected;
      }
      if (!activeTokenMatches(options, token)) {
        return staleResult();
      }
      const loaded =
        loadLayerDocumentProjectFromSfep(
          selected.value.bytes
        );
      if (!loaded.ok) {
        options.lifecycle.finishOperation(token);
        return {
          ok: false,
          error: {
            code: "invalid-project",
            message: loaded.error.message,
          },
        };
      }

      const project = loaded.value.project;
      const sources = Object.values(
        project.payload.sourceRegistry.sourcesById
      );
      const prepared: Array<{
        runtime:
          PreparedLayerDocumentLinkedSourceRuntime;
        file: File;
        handle: FileSystemFileHandle | null;
        permission:
          "unknown" | "prompt" | "granted";
      }> = [];
      const missingSourceIds = new Set<string>();
      const errorSourceIds = new Set<string>();
      const discardPrepared = () => {
        prepared.forEach((entry) =>
          entry.runtime.discard()
        );
      };

      for (
        const source
        of linkedDocumentSources(sources)
      ) {
        const ids = dependentSourceIds(
          source,
          sources
        );
        const access =
          await options.linkedSourceAccess.find({
            projectId: project.metadata.projectId,
            locatorId: source.locator.locatorId,
          });
        if (!activeTokenMatches(options, token)) {
          discardPrepared();
          return staleResult();
        }
        if (access.status !== "available") {
          ids.forEach((sourceId) => {
            if (access.status === "error") {
              errorSourceIds.add(sourceId);
            } else {
              missingSourceIds.add(sourceId);
            }
          });
          continue;
        }
        const runtime =
          await options.linkedSourcePreparation
            .prepare({
              project,
              source,
              file: access.file,
            });
        if (!activeTokenMatches(options, token)) {
          if (runtime.ok) runtime.value.discard();
          discardPrepared();
          return staleResult();
        }
        if (!runtime.ok) {
          ids.forEach((sourceId) =>
            errorSourceIds.add(sourceId)
          );
          continue;
        }
        if (
          !fingerprintsMatch(
            source.contentFingerprint,
            runtime.value.contentFingerprint
          )
        ) {
          runtime.value.discard();
          ids.forEach((sourceId) =>
            errorSourceIds.add(sourceId)
          );
          continue;
        }
        runtime.value.unavailableSourceIds.forEach(
          (sourceId) =>
            missingSourceIds.add(sourceId)
        );
        prepared.push({
          runtime: runtime.value,
          file: access.file,
          handle: access.handle,
          permission: access.permission,
        });
      }

      let resources = prepared.flatMap(
        (entry) => entry.runtime.resources
      );
      const preflight =
        options.sourceRuntime.preflightBatch(resources);
      if (!preflight.ok) {
        prepared.forEach((entry) => {
          entry.runtime.availableSourceIds.forEach(
            (sourceId) =>
              errorSourceIds.add(sourceId)
          );
          entry.runtime.discard();
        });
        resources = [];
      }
      if (!activeTokenMatches(options, token)) {
        discardPrepared();
        return staleResult();
      }
      const replaced =
        options.lifecycle.replaceProject({
          project,
          document: "file-backed",
          token,
        });
      if (!replaced.ok) {
        discardPrepared();
        return {
          ok: false,
          error: {
            code: replaced.error.code ===
              "stale-operation"
              ? "stale-operation"
              : "invalid-project",
            message: replaced.error.message,
          },
        };
      }

      if (resources.length > 0) {
        const registered =
          options.sourceRuntime.registerBatch(resources);
        if (registered.ok) {
          prepared.forEach((entry) =>
            entry.runtime.transfer()
          );
        } else {
          prepared.forEach((entry) => {
            entry.runtime.availableSourceIds.forEach(
              (sourceId) =>
                errorSourceIds.add(sourceId)
            );
            entry.runtime.discard();
          });
        }
      }
      prepared.forEach((entry) => {
        entry.runtime.availableSourceIds.forEach(
          (sourceId) => {
            if (
              errorSourceIds.has(sourceId) ||
              missingSourceIds.has(sourceId)
            ) return;
            options.sourceResolution.setAvailable({
              sourceId,
              file: entry.file,
              handle: entry.handle,
              permission: entry.permission,
            });
          }
        );
      });
      missingSourceIds.forEach((sourceId) =>
        options.sourceResolution.setMissing(sourceId)
      );
      errorSourceIds.forEach((sourceId) =>
        options.sourceResolution.setError(
          sourceId,
          "Linked Source runtime preparation failed"
        )
      );
      options.saveController?.commitTarget(
        selected.value.handle
          ? {
              kind: "native-file-system",
              fileName:
                selected.value.handle.name ||
                selected.value.file.name,
              handle: selected.value.handle,
            }
          : null
      );
      return {
        ok: true,
        readiness:
          missingSourceIds.size > 0 ||
          errorSourceIds.size > 0
            ? "ready-degraded"
            : "ready",
        project,
        missingSourceIds:
          [...missingSourceIds].sort(),
        errorSourceIds:
          [...errorSourceIds].sort(),
      };
    },
  };
}
