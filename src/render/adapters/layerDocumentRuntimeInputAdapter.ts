import type {
  GroupLayerDocument,
  LayerDocument,
  LayerDocumentProject,
  SourceRegistryRecord,
} from "@/models";
import {
  buildLayerDocumentGroupScopeReadModel,
  layerDocumentSourceVisualFingerprint,
} from "@/models";
import {
  globalFrameToLocalFrame,
} from "@/animation";
import {
  getEditorPlaceholderDescriptorForLayerType,
} from "@/render/adapters/editorPlaceholderInputAdapter";
import type {
  EvaluatedSceneNode,
} from "@/render/models/evaluatedSceneModel";
import type {
  LayerDocumentPsdSourceResolution,
  LayerDocumentPsdSourceResolver,
  LayerDocumentRuntimeContentDescriptor,
  LayerDocumentRuntimeInput,
  LayerDocumentEditorFrameReadModelResult,
  LayerDocumentFrameEvaluationResult,
  LayerDocumentSourceSamplingQuality,
  LayerDocumentSourceResolutionStatusReader,
  LayerDocumentTransformDraftSnapshot,
} from "@/render/models/layerDocumentRuntimeModel";
import {
  applyLayerDocumentTransformDraft,
  evaluateLayerDocumentTransform,
} from "@/render/helpers/layerDocumentRuntimeEvaluationHelpers";
import {
  buildLayerDocumentCompositionVisualResultCacheKey,
  buildLayerDocumentEvaluationIdentity,
  buildLayerDocumentSourceResourceCacheKey,
  buildLayerDocumentVisualResultCacheKey,
  layerDocumentSourceVisualKeyPolicy,
} from "@/render/helpers/layerDocumentRuntimeCacheKeyHelpers";
import {
  buildLayerDocumentRuntimeTargetReadModel,
} from "@/render/helpers/layerDocumentRuntimeTargetHelpers";
import type {
  RuntimeMetricRecordPort,
} from "@/render/models/runtimeMetricPortModel";
import { validateLayerDocumentProject } from "@/models";

interface RuntimeBuildContext {
  readonly project: LayerDocumentProject;
  readonly rootGlobalFrame: number;
  readonly sourceSamplingQuality:
    LayerDocumentSourceSamplingQuality;
  readonly draft: LayerDocumentTransformDraftSnapshot | null;
  readonly resolvePsdSource: LayerDocumentPsdSourceResolver;
  readonly readSourceResolutionStatus:
    LayerDocumentSourceResolutionStatusReader;
  readonly resolutionBySourceKey: Map<
    string,
    LayerDocumentPsdSourceResolution | null
  >;
  readonly inputs: LayerDocumentRuntimeInput[];
  readonly overlayInputs: {
    readonly inputIndex: number;
    readonly layer: LayerDocument;
    readonly compositionDurationFrames: number;
    readonly frameRate: number;
  }[];
  readonly unsupportedLayerDocumentIds: string[];
  readonly localFrameBySourceId: Map<string, number>;
  readonly localFrameByLayerDocumentId: Map<string, number>;
}

function sortedChildren(
  project: LayerDocumentProject,
  parentLayerDocumentId: string
): LayerDocument[] {
  return Object.values(project.payload.layerDocumentsById)
    .filter(
      (layer) =>
        layer.common.placement.parentLayerDocumentId ===
        parentLayerDocumentId
    )
    .sort(
      (left, right) =>
        left.common.placement.order - right.common.placement.order
    );
}

function isPlacementActive(
  placementFrame: number,
  layer: LayerDocument
): boolean {
  const placement = layer.common.placement;
  return (
    placement.visible &&
    placementFrame >= placement.startFrame &&
    placementFrame < placement.startFrame + placement.durationFrames
  );
}

function sourceRecordForLayer(
  project: LayerDocumentProject,
  layer: LayerDocument
): SourceRegistryRecord | null {
  const sourceId = layer.common.source?.sourceId;
  return sourceId
    ? project.payload.sourceRegistry.sourcesById[sourceId] ?? null
    : null;
}

function buildSourceResourceCacheKey(options: {
  source: SourceRegistryRecord | null;
  localFrame: number;
  sourceSamplingQuality:
    LayerDocumentSourceSamplingQuality;
}): string | null {
  return options.source
    ? buildLayerDocumentSourceResourceCacheKey({
        sourceId: options.source.sourceId,
        sourceKind: options.source.kind,
        visualKeyPolicy: layerDocumentSourceVisualKeyPolicy(
          options.source.kind
        ),
        sourceVersion: options.source.version,
        sourceFingerprint:
          layerDocumentSourceVisualFingerprint(options.source),
        localFrame: options.localFrame,
        sourceSamplingQuality:
          options.sourceSamplingQuality,
      })
    : null;
}

function resolvePsdContent(options: {
  context: RuntimeBuildContext;
  source: SourceRegistryRecord | null;
  localFrame: number;
  sourceResourceCacheKey: string | null;
}): LayerDocumentRuntimeContentDescriptor {
  const { context, source, localFrame, sourceResourceCacheKey } =
    options;
  if (!source || !sourceResourceCacheKey) {
    return { kind: "unavailable", reason: "missing-source" };
  }
  if (
    context.readSourceResolutionStatus(source.sourceId) !==
    "available"
  ) {
    return { kind: "unavailable", reason: "source-unavailable" };
  }
  if (!context.resolutionBySourceKey.has(sourceResourceCacheKey)) {
    context.resolutionBySourceKey.set(
      sourceResourceCacheKey,
      context.resolvePsdSource({
        sourceId: source.sourceId,
        source,
        localFrame,
        sourceSamplingQuality:
          context.sourceSamplingQuality,
        sourceResourceCacheKey,
      })
    );
  }
  const resolution =
    context.resolutionBySourceKey.get(sourceResourceCacheKey) ?? null;
  return resolution
    ? { kind: "drawable", resolution }
    : { kind: "unavailable", reason: "resolver-miss" };
}

function buildContentDescriptor(options: {
  context: RuntimeBuildContext;
  layer: LayerDocument;
  source: SourceRegistryRecord | null;
  localFrame: number;
  sourceResourceCacheKey: string | null;
}): LayerDocumentRuntimeContentDescriptor {
  const { layer, source } = options;
  if (
    layer.common.source &&
    (
      !source ||
      options.context.readSourceResolutionStatus(source.sourceId) !==
        "available"
    )
  ) {
    return {
      kind: "unavailable",
      reason: source ? "source-unavailable" : "missing-source",
    };
  }
  if (layer.type === "psd") {
    return resolvePsdContent({
      context: options.context,
      source,
      localFrame: options.localFrame,
      sourceResourceCacheKey: options.sourceResourceCacheKey,
    });
  }
  if (layer.type === "group") {
    return {
      kind: "composition",
      size: {
        width: layer.data.width,
        height: layer.data.height,
      },
    };
  }
  if (layer.type === "audio") {
    return { kind: "unsupported", layerType: "audio" };
  }
  const placeholder = getEditorPlaceholderDescriptorForLayerType(
    layer.type
  );
  if (placeholder) return { kind: "placeholder", placeholder };
  return {
    kind: "unsupported",
    layerType: layer.type as "video" | "shape" | "unknown",
  };
}

function draftMatches(
  layerDocumentId: string,
  globalFrame: number,
  localFrame: number,
  draft: LayerDocumentTransformDraftSnapshot | null
): draft is LayerDocumentTransformDraftSnapshot {
  return Boolean(
    draft &&
      draft.target.kind === "layer-document" &&
      draft.target.layerDocumentId === layerDocumentId &&
      draft.layerDocumentId === layerDocumentId &&
      draft.globalFrame === globalFrame &&
      draft.localFrame === localFrame
  );
}

function contentVisualIdentity(
  content: LayerDocumentRuntimeContentDescriptor
): unknown {
  switch (content.kind) {
    case "drawable":
      return [
        content.kind,
        content.resolution.renderItemId,
        content.resolution.drawableId,
        content.resolution.logicalSize,
      ];
    case "composition":
      return [content.kind, content.size];
    case "placeholder":
      return [content.kind, content.placeholder];
    case "unavailable":
      return [content.kind, content.reason];
    case "unsupported":
      return [content.kind, content.layerType];
  }
}

function buildRuntimeInput(options: {
  context: RuntimeBuildContext;
  layer: LayerDocument;
  placementFrame: number;
  frameRate: number;
}): LayerDocumentRuntimeInput {
  const { context, layer, placementFrame, frameRate } = options;
  const placement = layer.common.placement;
  const localFrame = globalFrameToLocalFrame(
    placementFrame,
    placement.startFrame,
    placement.sourceOffsetFrames
  );
  const source = sourceRecordForLayer(context.project, layer);
  const sourceResourceCacheKey = buildSourceResourceCacheKey({
    source,
    localFrame,
    sourceSamplingQuality:
      context.sourceSamplingQuality,
  });
  const base = evaluateLayerDocumentTransform(
    layer,
    localFrame,
    frameRate
  );
  const matchingDraft = draftMatches(
    layer.layerDocumentId,
    context.rootGlobalFrame,
    localFrame,
    context.draft
  )
    ? context.draft
    : null;
  const evaluated = matchingDraft
    ? applyLayerDocumentTransformDraft(base, matchingDraft.patch)
    : base;
  const target = {
    kind: "layer-document" as const,
    layerDocumentId: layer.layerDocumentId,
  };
  const content = buildContentDescriptor({
    context,
    layer,
    source,
    localFrame,
    sourceResourceCacheKey,
  });
  const draftIdentity = matchingDraft?.identity ?? null;
  const evaluationIdentity =
    buildLayerDocumentEvaluationIdentity({
      layerDocumentId: layer.layerDocumentId,
      revision: layer.revision,
      globalFrame: context.rootGlobalFrame,
      localFrame,
      sourceSamplingQuality:
        context.sourceSamplingQuality,
      sourceResourceCacheKey,
      draftIdentity,
    });
  const layerResultCacheKey =
    buildLayerDocumentVisualResultCacheKey({
      layerDocumentId: layer.layerDocumentId,
      sourceType: layer.type,
      sourceResourceCacheKey,
      order: placement.order,
      evaluatedTransform: evaluated.transform,
      opacity: evaluated.opacity,
      effects: layer.common.effects,
      modifiers: layer.common.modifiers,
      contentIdentity: contentVisualIdentity(content),
    });

  return {
    target,
    layerDocumentId: layer.layerDocumentId,
    sourceId: source?.sourceId ?? null,
    type: layer.type,
    revision: layer.revision,
    label: placement.alias ?? layer.name,
    globalFrame: context.rootGlobalFrame,
    localFrame,
    order: placement.order,
    evaluatedTransform: evaluated.transform,
    opacity: evaluated.opacity,
    effects: layer.common.effects,
    modifiers: layer.common.modifiers,
    content,
    sourceResourceCacheKey,
    evaluationIdentity,
    layerResultCacheKey,
    draftIdentity,
    draftApplied: Boolean(matchingDraft),
  };
}

function buildNode(options: {
  input: LayerDocumentRuntimeInput;
  children: EvaluatedSceneNode[];
}): EvaluatedSceneNode | null {
  const { input, children } = options;
  const common = {
    layerDocumentId: input.layerDocumentId,
    sourceId: input.sourceId,
    sourceResourceCacheKey:
      input.sourceResourceCacheKey,
    layerResultCacheKey: input.layerResultCacheKey,
    sourceType: input.type,
    localFrame: input.localFrame,
    visible: true as const,
    order: input.order,
    transform: input.evaluatedTransform,
    opacity: input.opacity,
  };
  switch (input.content.kind) {
    case "drawable":
      return {
        ...common,
        type: "drawable",
        renderItemId: input.content.resolution.renderItemId,
        drawableId: input.content.resolution.drawableId,
        logicalSize: input.content.resolution.logicalSize,
      };
    case "composition":
      return {
        ...common,
        type: "composition",
        renderItemId: input.layerDocumentId,
        targetCompId: input.layerDocumentId,
        size: input.content.size,
        children,
      };
    case "placeholder":
      return {
        ...common,
        type: "placeholder",
        renderItemId: null,
        sourceType: input.content.placeholder.placeholderKind,
        logicalSize: input.content.placeholder.size,
        placeholder: input.content.placeholder,
      };
    case "unavailable":
    case "unsupported":
      return null;
  }
}

function buildChildNodes(options: {
  context: RuntimeBuildContext;
  parent: GroupLayerDocument;
  placementFrame: number;
}): EvaluatedSceneNode[] {
  const { context, parent, placementFrame } = options;
  return sortedChildren(context.project, parent.layerDocumentId).flatMap(
    (layer) => {
      if (!isPlacementActive(placementFrame, layer)) return [];
      const input = buildRuntimeInput({
        context,
        layer,
        placementFrame,
        frameRate: parent.data.frameRate,
      });
      const inputIndex = context.inputs.length;
      context.inputs.push(input);
      context.localFrameByLayerDocumentId.set(
        layer.layerDocumentId,
        input.localFrame
      );
      if (
        input.sourceId &&
        !context.localFrameBySourceId.has(input.sourceId)
      ) {
        context.localFrameBySourceId.set(
          input.sourceId,
          input.localFrame
        );
      }
      const childNodes =
        layer.type === "group"
          ? buildChildNodes({
              context,
              parent: layer,
              placementFrame: input.localFrame,
            })
          : [];
      const resolvedInput =
        input.content.kind === "composition"
          ? {
              ...input,
              layerResultCacheKey:
                buildLayerDocumentCompositionVisualResultCacheKey(
                  input.layerResultCacheKey,
                  childNodes
                ),
            }
          : input;
      context.inputs[inputIndex] = resolvedInput;
      context.overlayInputs.push({
        inputIndex,
        layer,
        compositionDurationFrames: parent.data.durationFrames,
        frameRate: parent.data.frameRate,
      });
      if (resolvedInput.content.kind === "unsupported") {
        context.unsupportedLayerDocumentIds.push(layer.layerDocumentId);
      }
      const node = buildNode({
        input: resolvedInput,
        children: childNodes,
      });
      return node ? [node] : [];
    }
  );
}

type LayerDocumentFrameEvaluationOptions = {
  project: LayerDocumentProject;
  activeGroupLayerDocumentId?: string | null;
  globalFrame: number;
  sourceSamplingQuality:
    LayerDocumentSourceSamplingQuality;
  draft?: LayerDocumentTransformDraftSnapshot | null;
  resolvePsdSource: LayerDocumentPsdSourceResolver;
  readSourceResolutionStatus:
    LayerDocumentSourceResolutionStatusReader;
  runtimeMetrics?: RuntimeMetricRecordPort;
};

const PROJECT_WORKSPACE_PADDING = 128;

function getProjectWorkspaceGeometry(
  root: GroupLayerDocument,
  nodes: readonly EvaluatedSceneNode[]
) {
  const center = {
    x: root.data.width / 2,
    y: root.data.height / 2,
  };
  let halfWidth = root.data.width / 2;
  let halfHeight = root.data.height / 2;

  nodes.forEach((node) => {
    const size = node.type === "composition" ? node.size : node.logicalSize;
    // The project is a stable parent Group. Its viewport must never follow a
    // child's animated/dragged position, otherwise moving a layer also moves
    // the apparent workspace origin. Only intrinsic child sizes establish the
    // fixed editing area; child transforms follow normal Group rules inside it.
    halfWidth = Math.max(halfWidth, size.width / 2);
    halfHeight = Math.max(halfHeight, size.height / 2);
  });

  halfWidth += PROJECT_WORKSPACE_PADDING;
  halfHeight += PROJECT_WORKSPACE_PADDING;
  return {
    origin: {
      x: center.x - halfWidth,
      y: center.y - halfHeight,
    },
    size: {
      width: halfWidth * 2,
      height: halfHeight * 2,
    },
  };
}

function buildLayerDocumentFrameArtifacts(
  options: LayerDocumentFrameEvaluationOptions
):
  | {
      readonly ok: true;
      readonly scene: import("@/render/models/evaluatedSceneModel").EvaluatedScene;
      readonly context: RuntimeBuildContext;
    }
  | {
      readonly ok: false;
      readonly reason: "invalid-project" | "root-not-found";
    } {
  if (validateLayerDocumentProject(options.project).length > 0) {
    return { ok: false, reason: "invalid-project" };
  }
  const scope = buildLayerDocumentGroupScopeReadModel(
    options.project,
    options.activeGroupLayerDocumentId
  );
  if (!scope.ok) {
    return { ok: false, reason: scope.reason };
  }
  options.runtimeMetrics?.increment("animationEvaluation");
  const root = scope.model.activeGroup;

  const context: RuntimeBuildContext = {
    project: options.project,
    rootGlobalFrame: options.globalFrame,
    sourceSamplingQuality:
      options.sourceSamplingQuality,
    draft: options.draft ?? null,
    resolvePsdSource: options.resolvePsdSource,
    readSourceResolutionStatus:
      options.readSourceResolutionStatus,
    resolutionBySourceKey: new Map(),
    inputs: [],
    overlayInputs: [],
    unsupportedLayerDocumentIds: [],
    localFrameBySourceId: new Map(),
    localFrameByLayerDocumentId: new Map(),
  };
  const nodes = buildChildNodes({
    context,
    parent: root,
    placementFrame: options.globalFrame,
  });

  const geometry =
    root.data.role === "project-root"
      ? getProjectWorkspaceGeometry(root, nodes)
      : {
          origin: { x: 0, y: 0 },
          size: {
            width: root.data.width,
            height: root.data.height,
          },
        };

  const scene = {
    compositionId: root.layerDocumentId,
    globalFrame: options.globalFrame,
    size: geometry.size,
    origin: geometry.origin,
    localFrameBySourceId: context.localFrameBySourceId,
    localFrameByLayerDocumentId:
      context.localFrameByLayerDocumentId,
    nodes,
  };
  return {
    ok: true,
    scene,
    context,
  };
}

export function evaluateLayerDocumentFrame(
  options: LayerDocumentFrameEvaluationOptions
): LayerDocumentFrameEvaluationResult {
  const artifacts = buildLayerDocumentFrameArtifacts(options);
  return artifacts.ok
    ? { ok: true, scene: artifacts.scene }
    : artifacts;
}

export function buildLayerDocumentEditorFrameReadModel(
  options: LayerDocumentFrameEvaluationOptions
): LayerDocumentEditorFrameReadModelResult {
  const artifacts = buildLayerDocumentFrameArtifacts(options);
  if (!artifacts.ok) return artifacts;
  const { context } = artifacts;
  return {
    ok: true,
    model: {
      scene: artifacts.scene,
      inputs: context.inputs,
      targets: context.overlayInputs.map((overlayInput) =>
        buildLayerDocumentRuntimeTargetReadModel({
          input: context.inputs[overlayInput.inputIndex],
          layer: overlayInput.layer,
          compositionDurationFrames:
            overlayInput.compositionDurationFrames,
          frameRate: overlayInput.frameRate,
          draft: context.draft,
        })
      ),
      unsupportedLayerDocumentIds:
        context.unsupportedLayerDocumentIds,
    },
  };
}
