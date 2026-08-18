import type {
  LayerDocumentProject,
  LibrarySourceSelection,
} from "@/models";
import {
  buildDeleteLayerDocumentTransaction,
  buildSetLayerDocumentNameTransaction,
  buildUpdateLayerDocumentDomainTransaction,
  buildMoveLayerDocumentTransaction,
  buildUpdateLayerDocumentCommonTransaction,
  type LayerDocumentTransactionResult,
} from "@/models";
import type {
  LayerDocumentPreparedRuntimeLifecycle,
  LayerDocumentSourcePreparationPort,
  LayerDocumentSourceRuntimeResolutionPort,
  LayerDocumentSourceTransactionResult,
  PreparedLayerDocumentPsdImport,
  PreparedLayerDocumentPsdRefresh,
  SourceRegistryCacheInvalidationContext,
} from "@/engines/project";
import {
  prepareLayerDocumentDeleteWithOrphanSources,
} from "@/engines/project";
import type {
  LayerDocumentPsdRuntimeRegistrationBridge,
} from "@/render";
import type {
  LayerDocumentPreparedPsdConfirmResult,
} from "@/engines/library/models/layerDocumentPsdConfirmModel";

export type LayerDocumentPsdSourceCommitResult =
  | {
      readonly ok: true;
      readonly transition:
        NonNullable<
          LayerDocumentPreparedPsdConfirmResult["transition"]
        >;
    }
  | {
      readonly ok: false;
      readonly stage: "preparation" | "owner";
      readonly message: string;
    };

export function confirmLayerDocumentPsdPreparedSource(
  options: {
    runtime:
      LayerDocumentPreparedRuntimeLifecycle;
    bridge:
      LayerDocumentPsdRuntimeRegistrationBridge;
    prepare:
      () => LayerDocumentSourceTransactionResult;
    commit: (
      preparation: LayerDocumentSourceTransactionResult
    ) => LayerDocumentPsdSourceCommitResult;
    onRegistered: () => void;
  }
): LayerDocumentPreparedPsdConfirmResult {
  const claim = options.runtime.claimForConfirm();
  if (!claim.ok) {
    return {
      ok: false,
      status: "rejected",
      stage: "lifecycle",
      message: `Prepared runtime is ${claim.state}`,
      recovery: "none",
      transition: null,
      registration: null,
    };
  }
  const preflight =
    options.bridge.preflightResources(claim.resources);
  if (!preflight.ok) {
    if (claim.mode === "commit-owner") {
      options.runtime.failBeforeOwner();
    }
    return {
      ok: false,
      status: claim.mode === "commit-owner"
        ? "rejected"
        : "runtime-registration-pending",
      stage: "preflight",
      message: preflight.message,
      recovery: claim.mode === "commit-owner"
        ? "none"
        : "retry-runtime-registration",
      transition: null,
      registration: null,
    };
  }
  if (claim.mode === "retry-runtime-registration") {
    const registration =
      options.bridge.registerResources(claim.resources);
    if (!registration.ok) {
      options.runtime.markRegistrationFailed();
      return {
        ok: false,
        status: "runtime-registration-pending",
        stage: "runtime-registration",
        message: registration.message,
        recovery: "retry-runtime-registration",
        transition: null,
        registration,
      };
    }
    options.runtime.markTransferred();
    options.onRegistered();
    return {
      ok: true,
      status: "runtime-registration-retried",
      transition: null,
      registration,
    };
  }

  const committed = options.commit(options.prepare());
  if (!committed.ok) {
    options.runtime.failBeforeOwner();
    return {
      ok: false,
      status: "rejected",
      stage: committed.stage,
      message: committed.message,
      recovery: "none",
      transition: null,
      registration: null,
    };
  }
  options.runtime.markOwnerCommitted();
  const registration =
    options.bridge.registerResources(claim.resources);
  if (!registration.ok) {
    options.runtime.markRegistrationFailed();
    return {
      ok: false,
      status: "runtime-registration-pending",
      stage: "runtime-registration",
      message: registration.message,
      recovery: "retry-runtime-registration",
      transition: committed.transition,
      registration,
    };
  }
  options.runtime.markTransferred();
  options.onRegistered();
  return {
    ok: true,
    status: "confirmed",
    transition: committed.transition,
    registration,
  };
}

export function markLayerDocumentPsdResolutionAvailable(
  resolution: {
    readonly sourceIds: readonly string[];
    readonly documentSourceId: string;
    readonly file: File;
  },
  sourceResolution:
    LayerDocumentSourceRuntimeResolutionPort
) {
  resolution.sourceIds.forEach((sourceId) => {
    sourceResolution.setAvailable({
      sourceId,
      file: sourceId === resolution.documentSourceId
        ? resolution.file
        : null,
    });
  });
}

export function createLayerDocumentLibrarySourceCommandAdapter(
  options: {
    readProject: () => LayerDocumentProject;
    readSelectedLayerDocumentId:
      () => string | null;
    readActiveGroupLayerDocumentId:
      () => string;
    readSourceSelection:
      () => LibrarySourceSelection | null;
    selectLayer: (
      layerDocumentId: string | null
    ) => unknown;
    selectSource: (
      selection: LibrarySourceSelection | null
    ) => unknown;
    enterGroup: (
      layerDocumentId: string
    ) => unknown;
    preparation:
      LayerDocumentSourcePreparationPort;
    commit: (
      preparation:
        LayerDocumentSourceTransactionResult
    ) => LayerDocumentPsdSourceCommitResult;
    commitLayer: (transaction: LayerDocumentTransactionResult) => unknown;
    bridge:
      LayerDocumentPsdRuntimeRegistrationBridge;
    sourceResolution:
      LayerDocumentSourceRuntimeResolutionPort;
  }
) {
  const confirmImport = (
    prepared: PreparedLayerDocumentPsdImport
  ) =>
    confirmLayerDocumentPsdPreparedSource({
      runtime: prepared.runtime,
      bridge: options.bridge,
      prepare: () =>
        options.preparation.commands.prepareImport(
          options.readProject(),
          prepared.command
        ),
      commit: options.commit,
      onRegistered: () => {
        markLayerDocumentPsdResolutionAvailable(
          prepared.resolution,
          options.sourceResolution
        );
        const compositionLayerDocumentId =
          prepared.command.selectLayerDocumentId;
        const composition = compositionLayerDocumentId
          ? options.readProject().payload
              .layerDocumentsById[
                compositionLayerDocumentId
              ]
          : null;
        if (composition?.type === "group") {
          options.enterGroup(
            composition.layerDocumentId
          );
        }
      },
    });
  const confirmRefresh = (
    prepared: PreparedLayerDocumentPsdRefresh,
    cacheContext:
      SourceRegistryCacheInvalidationContext
  ) =>
    confirmLayerDocumentPsdPreparedSource({
      runtime: prepared.runtime,
      bridge: options.bridge,
      prepare: () =>
        options.preparation.commands
          .preparePsdRefresh(
            options.readProject(),
            {
              ...prepared.command,
              cacheContext,
            }
          ),
      commit: options.commit,
      onRegistered: () =>
        markLayerDocumentPsdResolutionAvailable(
          prepared.resolution,
          options.sourceResolution
        ),
    });
  const deleteLayerDocument = (layerDocumentId: string) => {
    const project = options.readProject();
    const layer = project.payload.layerDocumentsById[layerDocumentId];
    if (!layer || (layer.type === "group" && layer.data.role === "project-root")) return;
    if (layer.type === "group" && layer.data.role === "composition") {
      const parent = layer.common.placement.parentLayerDocumentId
        ? project.payload.layerDocumentsById[layer.common.placement.parentLayerDocumentId]
        : null;
      if (parent?.type === "group" && parent.data.role === "project-root") return;
    }
    const subtreeIds = new Set<string>();
    const collect = (parentId: string) => {
      subtreeIds.add(parentId);
      Object.values(project.payload.layerDocumentsById).forEach((candidate) => {
        if (
          candidate.common.placement.parentLayerDocumentId === parentId &&
          !subtreeIds.has(candidate.layerDocumentId)
        ) collect(candidate.layerDocumentId);
      });
    };
    collect(layerDocumentId);
    const containsAudio = Object.values(project.payload.layerDocumentsById)
      .some((candidate) => subtreeIds.has(candidate.layerDocumentId) && candidate.type === "audio");
    return containsAudio
      ? options.commit(
          prepareLayerDocumentDeleteWithOrphanSources(project, { layerDocumentId })
        )
      : options.commitLayer(
          buildDeleteLayerDocumentTransaction(project, { layerDocumentId })
        );
  };
  const moveLibraryLayer = (command: {
    layerDocumentId: string;
    targetLayerDocumentId: string;
    position: "before" | "inside" | "after";
  }) => {
    const project = options.readProject();
    const dragged = project.payload.layerDocumentsById[command.layerDocumentId];
    const target = project.payload.layerDocumentsById[command.targetLayerDocumentId];
    if (!dragged || !target || dragged.layerDocumentId === target.layerDocumentId) return;
    const root = Object.values(project.payload.layerDocumentsById).find((layer) =>
      layer.type === "group" && layer.data.role === "project-root"
    );
    if (!root) return;
    const isCut = (layer: typeof dragged) => layer.type === "group" && layer.data.role === "composition" && layer.common.placement.parentLayerDocumentId === root.layerDocumentId;
    let nextParentId: string;
    let nextOrder: number;
    if (isCut(dragged)) {
      if (!isCut(target) || command.position === "inside") return;
      nextParentId = root.layerDocumentId;
      nextOrder = target.common.placement.order + (command.position === "after" ? 1 : 0);
    } else if (command.position === "inside") {
      if (target.type !== "group" || target.data.role === "project-root") return;
      nextParentId = target.layerDocumentId;
      nextOrder = Object.values(project.payload.layerDocumentsById)
        .filter((layer) => layer.common.placement.parentLayerDocumentId === nextParentId)
        .length;
    } else {
      const targetParentId = target.common.placement.parentLayerDocumentId;
      if (!targetParentId) return;
      if (targetParentId === root.layerDocumentId && dragged.type !== "audio") return;
      nextParentId = targetParentId;
      nextOrder = target.common.placement.order + (command.position === "after" ? 1 : 0);
    }
    const moved = buildMoveLayerDocumentTransaction(project, {
      layerDocumentId: dragged.layerDocumentId,
      newParentLayerDocumentId: nextParentId,
      newOrder: nextOrder,
    });
    if (!moved.ok) return;
    if (dragged.type !== "audio" || dragged.common.placement.parentLayerDocumentId === nextParentId) {
      return options.commitLayer(moved);
    }
    const targetGroup = moved.transaction.after.payload.layerDocumentsById[nextParentId];
    if (targetGroup.type !== "group") return;
    const startFrame = Math.min(dragged.common.placement.startFrame, Math.max(0, targetGroup.data.durationFrames - 1));
    const durationFrames = Math.max(1, Math.min(dragged.common.placement.durationFrames, targetGroup.data.durationFrames - startFrame));
    const timed = buildUpdateLayerDocumentCommonTransaction(moved.transaction.after, {
      layerDocumentId: dragged.layerDocumentId,
      update: { kind: "set-placement-timing", startFrame, durationFrames, sourceOffsetFrames: dragged.common.placement.sourceOffsetFrames },
    });
    if (!timed.ok && timed.error.code !== "no-change") return;
    if (timed.ok) {
      moved.transaction.after = timed.transaction.after;
      moved.transaction.historyEntry.affectedLayerDocumentIds = [...new Set([
        ...moved.transaction.historyEntry.affectedLayerDocumentIds,
        ...timed.transaction.historyEntry.affectedLayerDocumentIds,
      ])].sort();
    }
    return options.commitLayer(moved);
  };
  return {
    readActiveGroupLayerDocumentId:
      options.readActiveGroupLayerDocumentId,
    openProject: () => {
      const project = options.readProject();
      const root = Object.values(
        project.payload.layerDocumentsById
      ).find((layer) =>
        layer.type === "group" &&
        layer.data.role === "project-root"
      );
      if (!root) return;
      const projectCenter = {
        x: (root.data as { width: number }).width / 2,
        y: (root.data as { height: number }).height / 2,
      };
      Object.values(project.payload.layerDocumentsById)
        .filter((layer) =>
          layer.common.placement.parentLayerDocumentId ===
            root.layerDocumentId
        )
        .forEach((layer) => {
          if (
            layer.type !== "group" ||
            layer.data.role !== "composition" ||
            !("width" in layer.data) ||
            !("height" in layer.data)
          ) {
            return;
          }
          if (
            layer.common.transform.position.x !==
              layer.common.transform.anchor.x ||
            layer.common.transform.position.y !==
              layer.common.transform.anchor.y
          ) {
            return;
          }
          options.commitLayer(
            buildUpdateLayerDocumentCommonTransaction(
              options.readProject(),
              {
                layerDocumentId: layer.layerDocumentId,
                update: {
                  kind: "set-transform",
                  transform: {
                    ...layer.common.transform,
                    position: projectCenter,
                    anchor: {
                      x: (layer.data as { width: number }).width / 2,
                      y: (layer.data as { height: number }).height / 2,
                    },
                  },
                },
              }
            )
          );
        });
      options.selectSource(null);
      options.selectLayer(null);
      return options.enterGroup(root.layerDocumentId);
    },
    selectSource: (
      selection: LibrarySourceSelection | null
    ) => {
      const sourceResult =
        options.selectSource(selection);
      if (!selection) return sourceResult;
      const project = options.readProject();
      const activeGroupLayerDocumentId =
        options.readActiveGroupLayerDocumentId();
      const layerDocument = Object.values(
        project.payload.layerDocumentsById
      )
        .filter(
          (layer) =>
            layer.common.source?.sourceId ===
            selection.sourceId
        )
        .sort((left, right) => {
          const leftInActiveGroup =
            left.common.placement
              .parentLayerDocumentId ===
            activeGroupLayerDocumentId;
          const rightInActiveGroup =
            right.common.placement
              .parentLayerDocumentId ===
            activeGroupLayerDocumentId;
          if (leftInActiveGroup !== rightInActiveGroup) {
            return leftInActiveGroup ? -1 : 1;
          }
          const order =
            left.common.placement.order -
            right.common.placement.order;
          return order ||
            left.layerDocumentId.localeCompare(
              right.layerDocumentId
            );
        })[0] ?? null;
      if (!layerDocument) return sourceResult;

      if (layerDocument.type === "group") {
        return options.enterGroup(
          layerDocument.layerDocumentId
        );
      }

      const parentLayerDocumentId =
        layerDocument.common.placement
          .parentLayerDocumentId;
      if (
        parentLayerDocumentId &&
        parentLayerDocumentId !==
          activeGroupLayerDocumentId
      ) {
        options.enterGroup(parentLayerDocumentId);
      }
      return options.selectLayer(
        layerDocument.layerDocumentId
      );
    },
    selectLayerDocument: (layerDocumentId: string) => {
      const layer = options.readProject().payload.layerDocumentsById[layerDocumentId];
      if (!layer) return;
      if (layer.common.source?.sourceId) {
        options.selectSource({
          kind: "library-source",
          sourceId: layer.common.source.sourceId,
        });
      }
      if (layer.type === "group") {
        return options.enterGroup(layer.layerDocumentId);
      }
      const parentId = layer.common.placement.parentLayerDocumentId;
      if (parentId && parentId !== options.readActiveGroupLayerDocumentId()) {
        options.enterGroup(parentId);
      }
      return options.selectLayer(layerDocumentId);
    },
    readSelectedLayerDocumentId: options.readSelectedLayerDocumentId,
    toggleAudioMuted: (layerDocumentId: string) => {
      const project = options.readProject();
      const layer = project.payload.layerDocumentsById[layerDocumentId];
      if (!layer || layer.type !== "audio") return;
      return options.commitLayer(buildUpdateLayerDocumentDomainTransaction(project, {
        layerDocumentId,
        update: { kind: "replace-audio-document", data: { ...layer.data, muted: !layer.data.muted } },
      }));
    },
    renameLayerDocument: (layerDocumentId: string, name: string) =>
      options.commitLayer(buildSetLayerDocumentNameTransaction(options.readProject(), { layerDocumentId, name })),
    deleteLayerDocument,
    toggleLayerVisibility: (layerDocumentId: string) => {
      const project = options.readProject();
      const layer = project.payload.layerDocumentsById[layerDocumentId];
      if (!layer) return;
      return options.commitLayer(buildUpdateLayerDocumentCommonTransaction(project, {
        layerDocumentId,
        update: { kind: "set-visibility", visible: !layer.common.placement.visible },
      }));
    },
    toggleLayerLock: (layerDocumentId: string) => {
      const project = options.readProject();
      const layer = project.payload.layerDocumentsById[layerDocumentId];
      if (!layer) return;
      return options.commitLayer(buildUpdateLayerDocumentCommonTransaction(project, {
        layerDocumentId,
        update: { kind: "set-lock", locked: !layer.common.placement.locked },
      }));
    },
    moveLibraryLayer,
    toggleSourceVisibility: (sourceId: string) => {
      const layer = Object.values(
        options.readProject().payload.layerDocumentsById
      ).find((candidate) =>
        candidate.common.source?.sourceId === sourceId
      );
      if (!layer) return;
      return options.commitLayer(
        buildUpdateLayerDocumentCommonTransaction(
          options.readProject(),
          {
            layerDocumentId: layer.layerDocumentId,
            update: {
              kind: "set-visibility",
              visible: !layer.common.placement.visible,
            },
          }
        )
      );
    },
    toggleSourceLock: (sourceId: string) => {
      const layer = Object.values(
        options.readProject().payload.layerDocumentsById
      ).find((candidate) =>
        candidate.common.source?.sourceId === sourceId
      );
      if (!layer) return;
      return options.commitLayer(
        buildUpdateLayerDocumentCommonTransaction(
          options.readProject(),
          {
            layerDocumentId: layer.layerDocumentId,
            update: {
              kind: "set-lock",
              locked: !layer.common.placement.locked,
            },
          }
        )
      );
    },
    renameSourceLayer: (sourceId: string, name: string) => {
      const layer = Object.values(
        options.readProject().payload.layerDocumentsById
      ).find((candidate) =>
        candidate.common.source?.sourceId === sourceId
      );
      if (!layer) return;
      return options.commitLayer(
        buildSetLayerDocumentNameTransaction(
          options.readProject(),
          { layerDocumentId: layer.layerDocumentId, name }
        )
      );
    },
    deleteSourceLayer: (sourceId: string) => {
      const project = options.readProject();
      const layers = Object.values(
        project.payload.layerDocumentsById
      );
      const layer = layers.find((candidate) =>
        candidate.common.source?.sourceId === sourceId
      );
      if (
        !layer ||
        (layer.type === "group" && layer.data.role === "composition")
      ) return;
      return deleteLayerDocument(layer.layerDocumentId);
    },
    readTree: () =>
      options.preparation.query.readTree({
        project: options.readProject(),
        selection: options.readSourceSelection(),
        resolution: options.sourceResolution,
      }),
    importSources: (
      command: Parameters<
        LayerDocumentSourcePreparationPort[
          "commands"
        ]["prepareImport"]
      >[1]
    ) =>
      options.commit(
        options.preparation.commands.prepareImport(
          options.readProject(),
          command
        )
      ),
    confirmPreparedPsdImport: confirmImport,
    cancelPreparedPsdImport: (
      prepared: PreparedLayerDocumentPsdImport
    ) => prepared.runtime.cancel(),
    confirmPreparedPsdRefresh: confirmRefresh,
    cancelPreparedPsdRefresh: (
      prepared: PreparedLayerDocumentPsdRefresh
    ) => prepared.runtime.cancel(),
    refreshSource: (
      command: Parameters<
        LayerDocumentSourcePreparationPort[
          "commands"
        ]["prepareRefresh"]
      >[1]
    ) =>
      options.commit(
        options.preparation.commands.prepareRefresh(
          options.readProject(),
          command
        )
      ),
    refreshPsd: (
      command: Parameters<
        LayerDocumentSourcePreparationPort[
          "commands"
        ]["preparePsdRefresh"]
      >[1]
    ) =>
      options.commit(
        options.preparation.commands.preparePsdRefresh(
          options.readProject(),
          command
        )
      ),
    reconnect: (
      command: Parameters<
        LayerDocumentSourcePreparationPort[
          "commands"
        ]["prepareReconnect"]
      >[1]
    ) =>
      options.commit(
        options.preparation.commands.prepareReconnect(
          options.readProject(),
          command
        )
      ),
    discover: (
      command: Parameters<
        LayerDocumentSourcePreparationPort[
          "commands"
        ]["prepareDiscovery"]
      >[1]
    ) =>
      options.commit(
        options.preparation.commands.prepareDiscovery(
          options.readProject(),
          command
        )
      ),
    deleteSource: (
      command: Parameters<
        LayerDocumentSourcePreparationPort[
          "commands"
        ]["prepareDelete"]
      >[1]
    ) =>
      options.commit(
        options.preparation.commands.prepareDelete(
          options.readProject(),
          command
        )
      ),
  };
}
