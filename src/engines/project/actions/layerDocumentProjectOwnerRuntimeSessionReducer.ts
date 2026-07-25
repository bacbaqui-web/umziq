import type {
  LayerDocumentProject,
} from "@/models";
import type {
  LayerDocumentOwnerRuntimeSession,
  LayerDocumentOwnerSession,
  LayerDocumentProjectOwnerState,
  LayerDocumentProjectOwnerTransitionResult,
  LayerDocumentTransformKeyframeSelection,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import {
  ownerStateWithStacks,
} from "@/engines/project/helpers/layerDocumentProjectOwnerHelpers";
import {
  failOwnerTransition,
  successOwnerTransition,
} from "@/engines/project/actions/layerDocumentProjectOwnerTransitionHelpers";
import {
  plainDataValuesEqual,
} from "@/engines/project/actions/layerDocumentSourceTransactionHelpers";
import {
  layerDocumentLocalFrameToGlobalFrame,
} from "@/models";

export function normalizeOwnerRuntimeSession(options: {
  project: LayerDocumentProject;
  session: LayerDocumentOwnerSession;
  runtimeSession: LayerDocumentOwnerRuntimeSession;
}): LayerDocumentOwnerRuntimeSession {
  const acknowledgedSourceStatuses =
    (
      options.runtimeSession
        .acknowledgedSourceStatuses ?? []
    ).filter((identity) => {
      const source =
        options.project.payload.sourceRegistry
          .sourcesById[identity.sourceId];
      return (
        source?.version === identity.version &&
        source.refresh.status === identity.status
      );
    });
  const acknowledgmentState =
    acknowledgedSourceStatuses.length > 0
      ? { acknowledgedSourceStatuses }
      : {};
  const selection =
    options.runtimeSession.selectedTransformKeyframe;
  if (!selection) {
    return {
      selectedTransformKeyframe: null,
      ...acknowledgmentState,
    };
  }
  const layer =
    options.project.payload.layerDocumentsById[
      selection.layerDocumentId
    ];
  const selectedLayerDocumentId =
    options.session.layerSelection?.layerDocumentId ??
    null;
  const keyframes = layer
    ? selection.property === "position"
      ? layer.common.animation.positionKeyframes
      : selection.property === "scale"
        ? layer.common.animation.scaleKeyframes
        : selection.property === "rotation"
          ? layer.common.animation.rotationKeyframes
          : layer.common.animation.opacityKeyframes
    : [];
  const keyframeExists = keyframes.some(
    (keyframe) =>
      keyframe.frame === selection.localFrame
  );
  if (
    selectedLayerDocumentId !==
      selection.layerDocumentId ||
    !keyframeExists
  ) {
    return {
      selectedTransformKeyframe: null,
      ...acknowledgmentState,
    };
  }
  return {
    selectedTransformKeyframe: {
      ...selection,
      globalFrame: layerDocumentLocalFrameToGlobalFrame(
        selection.localFrame,
        layer.common.placement
      ),
    },
    ...acknowledgmentState,
  };
}

export function reduceOwnerRuntimeKeyframeSelection(
  state: LayerDocumentProjectOwnerState,
  selection:
    LayerDocumentTransformKeyframeSelection | null
): LayerDocumentProjectOwnerTransitionResult {
  if (
    selection &&
    (
      ![
        "position",
        "scale",
        "rotation",
        "opacity",
      ].includes(selection.property) ||
      !Number.isInteger(selection.localFrame) ||
      selection.localFrame < 0 ||
      !Number.isInteger(selection.globalFrame)
    )
  ) {
    return failOwnerTransition(
      state,
      "invalid-session",
      "Transform keyframe selection must contain finite frames"
    );
  }
  const runtimeSession = normalizeOwnerRuntimeSession({
    project: state.currentProject,
    session: state.session,
    runtimeSession: {
      selectedTransformKeyframe: selection
        ? { ...selection }
        : null,
      acknowledgedSourceStatuses:
        state.runtimeSession
          .acknowledgedSourceStatuses,
    },
  });
  if (
    selection &&
    !runtimeSession.selectedTransformKeyframe
  ) {
    return failOwnerTransition(
      state,
      "invalid-session",
      "Transform keyframe selection must reference the selected Layer Document and an existing position keyframe"
    );
  }
  if (
    plainDataValuesEqual(
      state.runtimeSession,
      runtimeSession
    )
  ) {
    return successOwnerTransition({ previous: state, state });
  }
  return successOwnerTransition({
    previous: state,
    state: ownerStateWithStacks({
      project: state.currentProject,
      session: state.session,
      runtimeSession,
      undoStack: state.undoStack,
      redoStack: state.redoStack,
    }),
  });
}

export function reduceOwnerRuntimeSourceStatusAcknowledgment(
  state: LayerDocumentProjectOwnerState,
  sourceId: string
): LayerDocumentProjectOwnerTransitionResult {
  const source =
    state.currentProject.payload.sourceRegistry
      .sourcesById[sourceId];
  if (
    !source ||
    !["updated", "new", "deletePending"].includes(
      source.refresh.status
    )
  ) {
    return failOwnerTransition(
      state,
      "invalid-session",
      "Source status acknowledgment must reference a pending Source"
    );
  }
  const nextIdentity = {
    sourceId,
    version: source.version,
    status: source.refresh.status,
  };
  const runtimeSession =
    normalizeOwnerRuntimeSession({
      project: state.currentProject,
      session: state.session,
      runtimeSession: {
        selectedTransformKeyframe:
          state.runtimeSession
            .selectedTransformKeyframe,
        acknowledgedSourceStatuses: [
          ...(
            state.runtimeSession
              .acknowledgedSourceStatuses ?? []
          ).filter(
            (identity) =>
              identity.sourceId !== sourceId
          ),
          nextIdentity,
        ],
      },
    });
  if (
    plainDataValuesEqual(
      state.runtimeSession,
      runtimeSession
    )
  ) {
    return successOwnerTransition({
      previous: state,
      state,
    });
  }
  return successOwnerTransition({
    previous: state,
    state: ownerStateWithStacks({
      project: state.currentProject,
      session: state.session,
      runtimeSession,
      undoStack: state.undoStack,
      redoStack: state.redoStack,
    }),
  });
}
