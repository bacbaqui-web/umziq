import type {
  LayerDocumentProject,
  LibrarySourceSelection as PsdTreeSourceSelection,
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
import type {
  LayerDocumentPsdRuntimeRegistrationBridge,
} from "@/render";
import type {
  LayerDocumentPreparedPsdConfirmResult,
} from "@/engines/psd-tree/models/layerDocumentPsdConfirmModel";

export type { PsdTreeSourceSelection };

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
      readonly stage: "preparation" | "nexus";
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
    if (claim.mode === "commit-nexus") {
      options.runtime.failBeforeNexus();
    }
    return {
      ok: false,
      status: claim.mode === "commit-nexus"
        ? "rejected"
        : "runtime-registration-pending",
      stage: "preflight",
      message: preflight.message,
      recovery: claim.mode === "commit-nexus"
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
    options.runtime.failBeforeNexus();
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
  options.runtime.markNexusCommitted();
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
    });
  });
}

export function createLayerDocumentPsdTreeSourceCommandAdapter(
  options: {
    readProject: () => LayerDocumentProject;
    readSelectedLayerDocumentId:
      () => string | null;
    readActiveGroupLayerDocumentId:
      () => string;
    readSourceSelection:
      () => PsdTreeSourceSelection | null;
    selectLayer: (
      layerDocumentId: string | null
    ) => unknown;
    selectSource: (
      selection: PsdTreeSourceSelection | null
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
  return {
    selectSource: (
      selection: PsdTreeSourceSelection | null
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

      const source =
        project.payload.sourceRegistry.sourcesById[
          selection.sourceId
        ];
      if (
        source?.kind === "psd-document" &&
        layerDocument.type === "group"
      ) {
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
