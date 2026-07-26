import type {
  LayerDocumentGroupScopeReadModelResult,
  LayerDocumentProject,
  Position,
} from "@/models";
import {
  buildLayerDocumentEditorFrameReadModel,
  type LayerDocumentDraftInteractionPreparation,
  type LayerDocumentRuntimeInput,
  type LayerDocumentTransformDraftSnapshot,
  type PreviewSceneTransformPatch,
  type RuntimeMetricRecordPort,
} from "@/engines/playback-render";
import type {
  LayerDocumentSourceRuntimeResolutionReadPort,
  LayerDocumentTransformKeyframeSelection,
} from "@/engines/project";

export interface LayerDocumentCanvasDraftPort {
  readonly read:
    () => LayerDocumentTransformDraftSnapshot | null;
  readonly publish: (
    draft: LayerDocumentTransformDraftSnapshot
  ) => void;
  readonly clear: () => void;
}

type CanvasDraftCommitPreparation =
  | {
      readonly ok: true;
      readonly kind: "transform";
      readonly intent: Extract<
        LayerDocumentDraftInteractionPreparation,
        { kind: "pointer-up" }
      >["commitIntent"];
    }
  | {
      readonly ok: true;
      readonly kind: "motion-path";
      readonly layerDocumentId: string;
      readonly localFrame: number;
      readonly globalFrame: number;
      readonly position: Position;
    }
  | {
      readonly ok: false;
      readonly message: string;
      readonly layerDocumentId: string | null;
    };
type CanvasTransformCommitPreparation = Extract<
  CanvasDraftCommitPreparation,
  { readonly ok: false } |
    { readonly kind: "transform" }
>;
type CanvasMotionPathCommitPreparation = Extract<
  CanvasDraftCommitPreparation,
  { readonly ok: false } |
    { readonly kind: "motion-path" }
>;

export function createLayerDocumentCanvasDraftAdapter<
  TCommandResult,
>(
  options: {
    readProject: () => LayerDocumentProject;
    readActiveGroupLayerDocumentId: () => string;
    readSelectedLayerDocumentId:
      () => string | null;
    readSelectedTransformKeyframe:
      () => LayerDocumentTransformKeyframeSelection | null;
    readScope:
      () => LayerDocumentGroupScopeReadModelResult;
    draft: LayerDocumentCanvasDraftPort;
    resolvePsdSource:
      Parameters<
        typeof buildLayerDocumentEditorFrameReadModel
      >[0]["resolvePsdSource"];
    sourceResolution:
      LayerDocumentSourceRuntimeResolutionReadPort;
    incrementMetric: (name: string) => void;
    preparePointerMove: (options: {
      input: LayerDocumentRuntimeInput;
      patch: PreviewSceneTransformPatch;
    }) => LayerDocumentDraftInteractionPreparation;
    preparePointerUp: (
      draft: LayerDocumentTransformDraftSnapshot
    ) => LayerDocumentDraftInteractionPreparation;
    rejectCommit: (
      message: string,
      layerDocumentId: string | null
    ) => TCommandResult;
    commitTransform: (
      intent: Extract<
        LayerDocumentDraftInteractionPreparation,
        { kind: "pointer-up" }
      >["commitIntent"]
    ) => TCommandResult;
    commitMotionPath: (options: {
      layerDocumentId: string;
      localFrame: number;
      globalFrame: number;
      position: Position;
    }) => TCommandResult;
  }
) {
  const publish = (command: {
    layerDocumentId: string;
    patch: PreviewSceneTransformPatch;
    quality: string;
    globalFrame: number;
    expectedLocalFrame?: number;
  }) => {
    const runtime = buildLayerDocumentEditorFrameReadModel({
      project: options.readProject(),
      activeGroupLayerDocumentId:
        options.readActiveGroupLayerDocumentId(),
      globalFrame: command.globalFrame,
      quality: command.quality,
      draft: options.draft.read(),
      resolvePsdSource: options.resolvePsdSource,
      readSourceResolutionStatus: (sourceId) =>
        options.sourceResolution.read(sourceId).status,
    });
    if (!runtime.ok) return null;
    const runtimeInput = runtime.model.inputs.find(
      (candidate) =>
        candidate.layerDocumentId ===
        command.layerDocumentId
    );
    if (
      !runtimeInput ||
      (
        command.expectedLocalFrame !== undefined &&
        runtimeInput.localFrame !==
          command.expectedLocalFrame
      )
    ) {
      return null;
    }
    const preparation = options.preparePointerMove({
      input: runtimeInput,
      patch: command.patch,
    });
    if (preparation.kind !== "pointer-move") {
      return preparation;
    }
    options.draft.publish(preparation.draft);
    options.incrementMetric(
      "layerDocumentDraftPublication"
    );
    return preparation;
  };
  const publishMotionPath = (command: {
    layerDocumentId: string;
    globalFrame: number;
    localFrame: number;
    position: Position;
    quality: string;
  }) =>
    publish({
      layerDocumentId: command.layerDocumentId,
      patch: { position: command.position },
      quality: command.quality,
      globalFrame: command.globalFrame,
      expectedLocalFrame: command.localFrame,
    });
  const readViewProps = (command: {
    quality: string;
    globalFrame: number;
    runtimeMetrics?: RuntimeMetricRecordPort;
  }) => ({
    selectedLayerDocumentId:
      options.readSelectedLayerDocumentId(),
    selectedTransformKeyframe:
      options.readSelectedTransformKeyframe(),
    quality: command.quality,
    scope: options.readScope(),
    runtime: buildLayerDocumentEditorFrameReadModel({
      project: options.readProject(),
      activeGroupLayerDocumentId:
        options.readActiveGroupLayerDocumentId(),
      globalFrame: command.globalFrame,
      quality: command.quality,
      draft: options.draft.read(),
      resolvePsdSource: options.resolvePsdSource,
      readSourceResolutionStatus: (sourceId) =>
        options.sourceResolution.read(sourceId).status,
      runtimeMetrics: command.runtimeMetrics,
    }),
  });

  const prepareTransformCommit =
    (): CanvasTransformCommitPreparation => {
      const draft = options.draft.read();
      if (!draft) {
        return {
          ok: false,
          message:
            "Pointer-up requires a published transform Draft",
          layerDocumentId:
            options.readSelectedLayerDocumentId(),
        };
      }
      const interaction =
        options.preparePointerUp(draft);
      if (interaction.kind !== "pointer-up") {
        return {
          ok: false,
          message:
            "Pointer-up did not produce a commit intent",
          layerDocumentId: draft.layerDocumentId,
        };
      }
      return {
        ok: true,
        kind: "transform",
        intent: interaction.commitIntent,
      };
    };

  const prepareMotionPathCommit =
    (): CanvasMotionPathCommitPreparation => {
      const draft = options.draft.read();
      const position = draft?.patch.position;
      if (!draft || !position) {
        return {
          ok: false,
          message:
            "Motion Path pointer-up requires a position Draft",
          layerDocumentId:
            draft?.layerDocumentId ??
            options.readSelectedLayerDocumentId(),
        };
      }
      return {
        ok: true,
        kind: "motion-path",
        layerDocumentId: draft.layerDocumentId,
        localFrame: draft.localFrame,
        globalFrame: draft.globalFrame,
        position,
      };
    };
  const commitTransform = () => {
    const prepared = prepareTransformCommit();
    return prepared.ok
      ? options.commitTransform(prepared.intent)
      : options.rejectCommit(
          prepared.message,
          prepared.layerDocumentId
        );
  };
  const commitMotionPath = () => {
    const prepared = prepareMotionPathCommit();
    return prepared.ok
      ? options.commitMotionPath(prepared)
      : options.rejectCommit(
          prepared.message,
          prepared.layerDocumentId
        );
  };

  return {
    readViewProps,
    publish,
    publishMotionPath,
    commitTransform,
    commitMotionPath,
    cancel: options.draft.clear,
  };
}
