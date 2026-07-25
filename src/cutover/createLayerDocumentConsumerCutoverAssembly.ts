import {
  buildLayerDocumentGroupScopeReadModel,
  type LayerDocumentTransactionResult,
  type PsdTreeSourceSelection,
} from "@/models";
import {
  buildLayerDocumentRuntimeReadModel,
  createLayerDocumentPsdRuntimeRegistrationBridge,
} from "@/engines/playback-render";
import {
  type LayerDocumentPreparedRuntimeLifecycle,
  type LayerDocumentProjectOwnerTransitionResult,
  type LayerDocumentTransformKeyframeSelection,
  type LayerDocumentSourceTransactionResult,
} from "@/engines/project";
import type {
  LayerDocumentPsdRuntimeRegistrationBridge,
} from "@/engines/playback-render";
import type {
  LayerDocumentPanelCommandPreparation,
} from "@/engines/properties";
import type {
  LayerDocumentConsumerCutoverAssembly,
  LayerDocumentConsumerCutoverInput,
  LayerDocumentCutoverCommandResult,
  LayerDocumentPreparedPsdConfirmResult,
} from "@/cutover/layerDocumentConsumerCutoverModel";
import {
  buildLayerDocumentTimelineConsumerRows,
} from "@/cutover/layerDocumentTimelineConsumerAdapter";
import {
  createLayerDocumentTimelineCutoverCommandAdapter,
} from "@/cutover/layerDocumentTimelineIntentCommitAdapter";
import {
  applyLayerDocumentRuntimeCacheEffect,
} from "@/cutover/applyLayerDocumentRuntimeCacheEffect";

function ownerFailure<TPreparation>(
  transition: Extract<
    LayerDocumentProjectOwnerTransitionResult,
    { ok: false }
  >
): LayerDocumentCutoverCommandResult<TPreparation> {
  return {
    ok: false,
    stage: "owner",
    message: transition.error.message,
    transition,
  };
}

function preparationFailure<TPreparation>(
  message: string,
  preparation: TPreparation
): LayerDocumentCutoverCommandResult<TPreparation> {
  return {
    ok: false,
    stage: "preparation",
    message,
    preparation,
  };
}

function deliverOwnerTransition<TPreparation = unknown>(
  input: LayerDocumentConsumerCutoverInput,
  transition: LayerDocumentProjectOwnerTransitionResult
): LayerDocumentCutoverCommandResult<TPreparation> {
  if (!transition.ok) return ownerFailure(transition);
  if (transition.effect.clearDraft) {
    input.draftSession.clear();
  }
  applyLayerDocumentRuntimeCacheEffect(input, transition.effect);
  if (transition.changed) {
    input.metrics.increment(
      "layerDocumentCutoverOwnerTransition"
    );
  }
  if (transition.effect.recomputeRender) {
    input.metrics.increment(
      "layerDocumentCutoverRenderRecompute"
    );
  }
  input.effects.applyOwnerEffect(transition.effect);
  return { ok: true, transition };
}

function commitLayerPreparation(
  input: LayerDocumentConsumerCutoverInput,
  preparation: LayerDocumentTransactionResult,
  selectTransformKeyframe?:
    LayerDocumentTransformKeyframeSelection
): LayerDocumentCutoverCommandResult<
  LayerDocumentTransactionResult
> {
  if (!preparation.ok) {
    return preparationFailure(
      preparation.error.message,
      preparation
    );
  }
  return deliverOwnerTransition(
    input,
    input.owner.transition({
      kind: "commit-layer-transaction",
      transaction: preparation.transaction,
      ...(selectTransformKeyframe
        ? { selectTransformKeyframe }
        : {}),
    })
  );
}

function commitSourcePreparation(
  input: LayerDocumentConsumerCutoverInput,
  preparation: LayerDocumentSourceTransactionResult
): LayerDocumentCutoverCommandResult<
  LayerDocumentSourceTransactionResult
> {
  if (!preparation.ok) {
    return preparationFailure(
      preparation.error.message,
      preparation
    );
  }
  return deliverOwnerTransition(
    input,
    input.owner.transition({
      kind: "commit-source-transaction",
      transaction: preparation.transaction,
    })
  );
}

function confirmPreparedSource(options: {
  input: LayerDocumentConsumerCutoverInput;
  runtime: LayerDocumentPreparedRuntimeLifecycle;
  bridge: LayerDocumentPsdRuntimeRegistrationBridge;
  prepare: () => LayerDocumentSourceTransactionResult;
}): LayerDocumentPreparedPsdConfirmResult {
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
  const preflight = options.bridge.preflightResources(
    claim.resources
  );
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
    const registration = options.bridge.registerResources(
      claim.resources
    );
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
    return {
      ok: true,
      status: "runtime-registration-retried",
      transition: null,
      registration,
    };
  }

  const committed = commitSourcePreparation(
    options.input,
    options.prepare()
  );
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
  const registration = options.bridge.registerResources(
    claim.resources
  );
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
  return {
    ok: true,
    status: "confirmed",
    transition: committed.transition,
    registration,
  };
}

function commitPanelPreparation(
  input: LayerDocumentConsumerCutoverInput,
  preparation: LayerDocumentPanelCommandPreparation,
  selectTransformKeyframe?:
    LayerDocumentTransformKeyframeSelection
): LayerDocumentCutoverCommandResult<
  LayerDocumentPanelCommandPreparation
> {
  if (!preparation.ok) {
    return preparationFailure(
      preparation.message,
      preparation
    );
  }
  return deliverOwnerTransition(
    input,
    input.owner.transition({
      kind: "commit-layer-transaction",
      transaction: preparation.transaction,
      ...(selectTransformKeyframe
        ? { selectTransformKeyframe }
        : {}),
    })
  );
}

export function createLayerDocumentConsumerCutoverAssembly(
  input: LayerDocumentConsumerCutoverInput
): LayerDocumentConsumerCutoverAssembly {
  const currentProject = () =>
    input.owner.state.currentProject;
  const selectedLayerDocumentId = () =>
    input.owner.state.session.layerSelection
      ?.layerDocumentId ?? null;
  const activeGroupLayerDocumentId = () =>
    input.owner.state.session.activeGroupLayerDocumentId;
  const readScope = () =>
    buildLayerDocumentGroupScopeReadModel(
      currentProject(),
      activeGroupLayerDocumentId()
    );

  const selectLayer = (
    layerDocumentId: string | null
  ): LayerDocumentCutoverCommandResult =>
    deliverOwnerTransition(
      input,
      input.owner.transition({
        kind: "set-layer-selection",
        selection: layerDocumentId
          ? {
              kind: "layer-document",
              layerDocumentId,
            }
          : null,
      })
    );
  const selectSource = (
    selection: PsdTreeSourceSelection | null
  ): LayerDocumentCutoverCommandResult =>
    deliverOwnerTransition(
      input,
      input.owner.transition({
        kind: "set-source-selection",
        selection,
      })
    );
  const timelineCommands =
    createLayerDocumentTimelineCutoverCommandAdapter({
      owner: input.owner,
      readProject: currentProject,
      commit: (transaction, selection) =>
        commitLayerPreparation(
          input,
          transaction,
          selection
        ),
      deliver: (transition) =>
        deliverOwnerTransition(input, transition),
    });
  const dispatchTimelineIntent =
    timelineCommands.dispatchIntent;
  const selectTransformKeyframe =
    timelineCommands.selectTransformKeyframe;
  const acknowledgeSourceStatus = (sourceId: string) =>
    deliverOwnerTransition(input, input.owner.transition({
      kind: "acknowledge-source-status", sourceId,
    }));
  const dispatchPanel:
  LayerDocumentConsumerCutoverAssembly[
    "properties"
  ]["dispatch"] = (command) =>
    commitPanelPreparation(
      input,
      input.panelPreparation.commands.prepare({
        project: currentProject(),
        selectedLayerDocumentId:
          selectedLayerDocumentId(),
        command,
      })
    );
  const runtimeRegistrationBridge =
    createLayerDocumentPsdRuntimeRegistrationBridge(
      input.sourceRuntime
    );
  const publishCanvasDraft = (options: {
    layerDocumentId: string;
    patch: Parameters<
      LayerDocumentConsumerCutoverAssembly[
        "canvas"
      ]["pointerMove"]
    >[0]["patch"];
    quality: string;
    globalFrame: number;
    expectedLocalFrame?: number;
  }) => {
    const runtime = buildLayerDocumentRuntimeReadModel({
      project: currentProject(),
      activeGroupLayerDocumentId:
        activeGroupLayerDocumentId(),
      globalFrame: options.globalFrame,
      quality: options.quality,
      draft: input.draftSession.read(),
      resolvePsdSource:
        input.sourceRuntime.createPsdResolver(),
    });
    if (!runtime.ok) return null;
    const runtimeInput = runtime.model.inputs.find(
      (candidate) =>
        candidate.layerDocumentId ===
        options.layerDocumentId
    );
    if (
      !runtimeInput ||
      (
        options.expectedLocalFrame !== undefined &&
        runtimeInput.localFrame !==
          options.expectedLocalFrame
      )
    ) {
      return null;
    }
    const preparation =
      input.panelPreparation.draft.preparePointerMove({
        input: runtimeInput,
        patch: options.patch,
      });
    if (preparation.kind !== "pointer-move") {
      return preparation;
    }
    input.draftSession.publish(preparation.draft);
    input.metrics.increment(
      "layerDocumentCutoverDraftPublication"
    );
    return preparation;
  };
  const commitCanvasDraft = ():
  LayerDocumentCutoverCommandResult<
    LayerDocumentPanelCommandPreparation
  > => {
    const draft = input.draftSession.read();
    if (!draft) {
      const project = currentProject();
      const selection = selectedLayerDocumentId();
      return preparationFailure(
        "Pointer-up requires a published transform Draft",
        {
          ok: false,
          status: "rejected",
          selectedLayerDocumentId: selection,
          layerDocumentId: selection,
          reason: selection ? "no-change" : "no-selection",
          errorCode: null,
          message:
            "Pointer-up requires a published transform Draft",
          project,
          projectUpdateCount: 0,
          transactionCount: 0,
          historyEntryCount: 0,
        }
      );
    }
    const interaction =
      input.panelPreparation.draft.preparePointerUp(draft);
    if (interaction.kind !== "pointer-up") {
      const project = currentProject();
      const selection = selectedLayerDocumentId();
      return preparationFailure(
        "Pointer-up did not produce a commit intent",
        {
          ok: false,
          status: "rejected",
          selectedLayerDocumentId: selection,
          layerDocumentId: draft.layerDocumentId,
          reason: "transaction-error",
          errorCode: null,
          message:
            "Pointer-up did not produce a commit intent",
          project,
          projectUpdateCount: 0,
          transactionCount: 0,
          historyEntryCount: 0,
        }
      );
    }
    return dispatchPanel({
      kind: "commit-transform",
      intent: interaction.commitIntent,
    });
  };
  const commitCanvasMotionPathDraft = ():
  LayerDocumentCutoverCommandResult<
    LayerDocumentPanelCommandPreparation
  > => {
    const draft = input.draftSession.read();
    const position = draft?.patch.position;
    if (!draft || !position) {
      const project = currentProject();
      const selection = selectedLayerDocumentId();
      return preparationFailure(
        "Motion Path pointer-up requires a position Draft",
        {
          ok: false,
          status: "rejected",
          selectedLayerDocumentId: selection,
          layerDocumentId:
            draft?.layerDocumentId ?? selection,
          reason: selection ? "no-change" : "no-selection",
          errorCode: null,
          message:
            "Motion Path pointer-up requires a position Draft",
          project,
          projectUpdateCount: 0,
          transactionCount: 0,
          historyEntryCount: 0,
        }
      );
    }
    return commitPanelPreparation(
      input,
      input.panelPreparation.commands.prepare({
        project: currentProject(),
        selectedLayerDocumentId:
          selectedLayerDocumentId(),
        command: {
          kind: "upsert-position-keyframe",
          layerDocumentId:
            draft.layerDocumentId,
          localFrame: draft.localFrame,
          value: position,
        },
      }),
      {
        layerDocumentId: draft.layerDocumentId,
        property: "position",
        localFrame: draft.localFrame,
        globalFrame: draft.globalFrame,
      }
    );
  };
  return {
    project: {
      read: currentProject,
      undo: () =>
        deliverOwnerTransition(
          input,
          input.owner.transition({ kind: "undo" })
        ),
      redo: () =>
        deliverOwnerTransition(
          input,
          input.owner.transition({ kind: "redo" })
        ),
    },
    selection: {
      selectLayer,
      selectSource,
    },
    scope: {
      read: readScope,
      enter: (layerDocumentId) =>
        deliverOwnerTransition(
          input,
          input.owner.transition({
            kind: "set-active-group",
            layerDocumentId,
          })
        ),
    },
    playback: {
      read: () => input.owner.state.session.playback,
      set: (playback) =>
        deliverOwnerTransition(
          input,
          input.owner.transition({
            kind: "set-playback-session",
            playback,
          })
        ),
    },
    timeline: {
      readViewProps: () => {
        const projection =
          buildLayerDocumentTimelineConsumerRows(
            currentProject(),
            activeGroupLayerDocumentId()
          );
        const playback =
          input.owner.state.session.playback;
        return {
          available: projection.available,
          selectedLayerDocumentId:
            selectedLayerDocumentId(),
          selectedTransformKeyframe:
            input.owner.state.runtimeSession
              .selectedTransformKeyframe,
          acknowledgedSourceStatuses: input.owner.state.runtimeSession
            .acknowledgedSourceStatuses ?? [],
          currentFrame: playback.currentFrame,
          playbackRange: playback.range,
          scope: readScope(),
          rows: projection.rows,
          commands: {
            selectLayer,
            dispatchIntent: dispatchTimelineIntent,
          },
        };
      },
      dispatchIntent: dispatchTimelineIntent,
      selectTransformKeyframe,
      acknowledgeSourceStatus,
    },
    canvas: {
      readViewProps: ({ quality, rendererMode }) => ({
        selectedLayerDocumentId:
          selectedLayerDocumentId(),
        selectedTransformKeyframe:
          input.owner.state.runtimeSession
            .selectedTransformKeyframe,
        rendererMode,
        quality,
        scope: readScope(),
        runtime: buildLayerDocumentRuntimeReadModel({
          project: currentProject(),
          activeGroupLayerDocumentId:
            activeGroupLayerDocumentId(),
          globalFrame:
            input.owner.state.session.playback.currentFrame,
          quality,
          draft: input.draftSession.read(),
          resolvePsdSource:
            input.sourceRuntime.createPsdResolver(),
        }),
      }),
      pointerMove: ({
        layerDocumentId,
        patch,
        quality,
      }) =>
        publishCanvasDraft({
          layerDocumentId,
          patch,
          quality,
          globalFrame:
            input.owner.state.session.playback.currentFrame,
        }),
      pointerUp: commitCanvasDraft,
      motionPathPointerMove: ({
        layerDocumentId,
        globalFrame,
        localFrame,
        position,
        quality,
      }) =>
        publishCanvasDraft({
          layerDocumentId,
          patch: { position },
          quality,
          globalFrame,
          expectedLocalFrame: localFrame,
        }),
      motionPathPointerUp:
        commitCanvasMotionPathDraft,
      cancelDraft: () => input.draftSession.clear(),
      directSelect: (layerDocumentId) =>
        selectLayer(layerDocumentId),
      selectMotionPathKeyframe: (selection) =>
        deliverOwnerTransition(
          input,
          input.owner.transition({
            kind: "set-transform-keyframe-selection",
            selection,
          })
        ),
    },
    properties: {
      describe: () =>
        input.panelPreparation.query.describe({
          project: currentProject(),
          selectedLayerDocumentId:
            selectedLayerDocumentId(),
        }),
      dispatch: dispatchPanel,
    },
    domains: {
      drawing: {
        query: (layerDocumentId) =>
          input.drawingPreparation.query(
            currentProject(),
            layerDocumentId
          ),
        update: (command) =>
          commitLayerPreparation(
            input,
            input.drawingPreparation
              .prepareUpdate(currentProject(), command)
          ),
      },
      text: {
        query: (layerDocumentId) =>
          input.textPreparation.query(
            currentProject(),
            layerDocumentId
          ),
        update: (command) =>
          commitLayerPreparation(
            input,
            input.textPreparation
              .prepareUpdate(currentProject(), command)
          ),
      },
      audio: {
        query: (layerDocumentId) =>
          input.audioPreparation.query(
            currentProject(),
            layerDocumentId
          ),
        prepareFutureCommand: (command) =>
          input.audioPreparation
            .prepareFutureCommand(
              currentProject(),
              command
            ),
      },
    },
    sources: {
      readTree: () =>
        input.sourcePreparation.query
          .readTree({
            project: currentProject(),
            selection:
              input.owner.state.session.sourceSelection,
          }),
      importSources: (command) =>
        commitSourcePreparation(
          input,
          input.sourcePreparation.commands
            .prepareImport(currentProject(), command)
        ),
      confirmPreparedPsdImport: (prepared) => {
        return confirmPreparedSource({
          input,
          runtime: prepared.runtime,
          bridge: runtimeRegistrationBridge,
          prepare: () =>
            input.sourcePreparation.commands.prepareImport(
              currentProject(),
              prepared.command
            ),
        });
      },
      cancelPreparedPsdImport: (prepared) =>
        prepared.runtime.cancel(),
      confirmPreparedPsdRefresh: (prepared, cacheContext) =>
        confirmPreparedSource({
          input,
          runtime: prepared.runtime,
          bridge: runtimeRegistrationBridge,
          prepare: () =>
            input.sourcePreparation.commands.preparePsdRefresh(
              currentProject(),
              {
                ...prepared.command,
                cacheContext,
              }
            ),
        }),
      cancelPreparedPsdRefresh: (prepared) =>
        prepared.runtime.cancel(),
      refreshSource: (command) =>
        commitSourcePreparation(
          input,
          input.sourcePreparation.commands
            .prepareRefresh(currentProject(), command)
        ),
      refreshPsd: (command) =>
        commitSourcePreparation(
          input,
          input.sourcePreparation.commands
            .preparePsdRefresh(currentProject(), command)
        ),
      markMissing: (command) =>
        commitSourcePreparation(
          input,
          input.sourcePreparation.commands
            .prepareMissing(currentProject(), command)
        ),
      reconnect: (command) =>
        commitSourcePreparation(
          input,
          input.sourcePreparation.commands
            .prepareReconnect(currentProject(), command)
        ),
      discover: (command) =>
        commitSourcePreparation(
          input,
          input.sourcePreparation.commands
            .prepareDiscovery(currentProject(), command)
        ),
      deleteSource: (command) =>
        commitSourcePreparation(
          input,
          input.sourcePreparation.commands
            .prepareDelete(currentProject(), command)
        ),
    },
    runtime: {
      resources: input.sourceRuntime,
      registrationBridge: runtimeRegistrationBridge,
    },
  };
}
