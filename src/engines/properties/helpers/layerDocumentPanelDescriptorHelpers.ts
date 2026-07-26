import type {
  LayerDocument,
  LayerDocumentProject,
  SourceRegistryRecord,
} from "@/models";
import {
  layerDocumentSourceDescriptorPath,
} from "@/models";
import type {
  LayerDocumentPanelCapabilities,
  LayerDocumentPanelCapability,
  LayerDocumentPanelDescriptorResult,
  LayerDocumentPanelSourceDescriptor,
  LayerDocumentPanelTypeData,
} from "@/engines/properties/models/layerDocumentPanelModel";

function clonePlainData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isProjectRoot(layer: LayerDocument): boolean {
  return layer.type === "group" && layer.data.role === "project-root";
}

function capability(
  status: LayerDocumentPanelCapability["status"],
  reason: string
): LayerDocumentPanelCapability {
  return { status, reason };
}

function buildCapabilities(
  layer: LayerDocument
): LayerDocumentPanelCapabilities {
  const root = isProjectRoot(layer);
  const commonEditable = root
    ? capability(
        "unsupported",
        "Project root common editing is reserved for project settings."
      )
    : capability(
        "editable",
        "Every non-root Layer Document owns this common field."
      );
  const placement = root
    ? capability(
        "read-only",
        "Project root has no parent placement."
      )
    : capability(
        "editable",
        "Placement belongs to this Layer Document."
      );
  const animation = root
    ? capability(
        "editable",
        "Project root Scale, Rotation, and Opacity tracks keep their established behavior."
      )
    : commonEditable;

  let domain: LayerDocumentPanelCapabilities["domain"];
  switch (layer.type) {
    case "drawing":
      domain = {
        type: "drawing",
        ...capability(
          "editable",
          "Drawing data uses the Drawing transaction adapter."
        ),
      };
      break;
    case "text":
      domain = {
        type: "text",
        ...capability(
          "editable",
          "Text data uses the Text transaction adapter."
        ),
      };
      break;
    case "audio":
      domain = {
        type: "audio",
        ...capability(
          "future",
          "Audio Layer data is currently an empty schema."
        ),
      };
      break;
    case "video":
      domain = {
        type: "video",
        ...capability(
          "future",
          "Video domain editing is not implemented."
        ),
      };
      break;
    case "shape":
      domain = {
        type: "shape",
        ...capability(
          "future",
          "Shape domain editing is not implemented."
        ),
      };
      break;
    case "group":
      domain = {
        type: "group",
        ...capability(
          "read-only",
          root
            ? "Project root metadata is owned by project settings."
            : "Group composition metadata is read-only in this preparation."
        ),
      };
      break;
    case "psd":
      domain = {
        type: "psd",
        ...capability(
          "read-only",
          "PSD pixels are resolved from Source Registry resources."
        ),
      };
      break;
    case "unknown":
      domain = {
        type: "unknown",
        ...capability(
          "unsupported",
          "Unknown Layer data is preserved but not editable."
        ),
      };
      break;
  }

  return {
    transform: commonEditable,
    transformInputs: {
      position: root
        ? capability(
            "unsupported",
            "Project root position is reserved for project settings."
          )
        : commonEditable,
      scale: root
        ? capability(
            "editable",
            "Project root scale keeps its confirmed edit behavior."
          )
        : commonEditable,
      rotation: root
        ? capability(
            "editable",
            "Project root rotation keeps its confirmed edit behavior."
          )
        : commonEditable,
      opacity: root
        ? capability(
            "editable",
            "Project root opacity keeps its confirmed edit behavior."
          )
        : commonEditable,
      anchor: root
        ? capability(
            "unsupported",
            "Project root anchor is reserved for project settings."
          )
        : commonEditable,
    },
    placement,
    animation,
    effects: commonEditable,
    modifiers: commonEditable,
    domain,
  };
}

function buildSourceDescriptor(
  project: LayerDocumentProject,
  layer: LayerDocument,
  readSourceResolutionStatus: (
    sourceId: string
  ) =>
    | "unresolved"
    | "resolving"
    | "available"
    | "missing"
    | "error"
): LayerDocumentPanelSourceDescriptor {
  const sourceId = layer.common.source?.sourceId;
  if (!sourceId) {
    return {
      referenceStatus: "none",
      sourceId: null,
      resolutionStatus: null,
      displayName: null,
      path: null,
      kind: null,
      refreshStatus: null,
    };
  }
  const source: SourceRegistryRecord | undefined =
    project.payload.sourceRegistry.sourcesById[sourceId];
  if (!source) {
    return {
      referenceStatus: "unresolved",
      sourceId,
      resolutionStatus: "missing",
      displayName: null,
      path: null,
      kind: null,
      refreshStatus: null,
    };
  }
  return {
    referenceStatus: "resolved",
    sourceId,
    resolutionStatus:
      readSourceResolutionStatus(source.sourceId),
    displayName: source.displayName,
    path: layerDocumentSourceDescriptorPath(source),
    kind: source.kind,
    refreshStatus: source.refresh.status,
  };
}

function buildTypeData(layer: LayerDocument): LayerDocumentPanelTypeData {
  switch (layer.type) {
    case "psd":
      return { kind: "psd", data: clonePlainData(layer.data) };
    case "drawing":
      return { kind: "drawing", data: clonePlainData(layer.data) };
    case "text":
      return { kind: "text", data: clonePlainData(layer.data) };
    case "audio":
      return {
        kind: "audio",
        data: clonePlainData(layer.data),
        dataSchema: "empty",
      };
    case "video":
      return {
        kind: "video",
        data: clonePlainData(layer.data),
        dataSchema: "empty",
      };
    case "shape":
      return { kind: "shape", data: clonePlainData(layer.data) };
    case "group":
      return { kind: "group", data: clonePlainData(layer.data) };
    case "unknown":
      return { kind: "unknown", data: clonePlainData(layer.data) };
  }
}

export function buildLayerDocumentPanelDescriptor(options: {
  project: LayerDocumentProject;
  selectedLayerDocumentId: string | null;
  readSourceResolutionStatus: (
    sourceId: string
  ) =>
    | "unresolved"
    | "resolving"
    | "available"
    | "missing"
    | "error";
}): LayerDocumentPanelDescriptorResult {
  const selectedLayerDocumentId = options.selectedLayerDocumentId;
  if (!selectedLayerDocumentId) {
    return {
      status: "empty",
      selectedLayerDocumentId: null,
      reason: "no-selection",
      descriptor: null,
    };
  }
  const layer =
    options.project.payload.layerDocumentsById[selectedLayerDocumentId];
  if (!layer) {
    return {
      status: "empty",
      selectedLayerDocumentId,
      reason: "layer-not-found",
      descriptor: null,
    };
  }
  const placement = layer.common.placement;
  return {
    status: "ready",
    selectedLayerDocumentId,
    descriptor: {
      selectedLayerDocumentId,
      layerDocumentId: layer.layerDocumentId,
      revision: layer.revision,
      type: layer.type,
      isProjectRoot: isProjectRoot(layer),
      name: layer.name,
      alias: placement.alias,
      displayName: placement.alias ?? layer.name,
      source: buildSourceDescriptor(
        options.project,
        layer,
        options.readSourceResolutionStatus
      ),
      transform: clonePlainData(layer.common.transform),
      placement: {
        parentLayerDocumentId: placement.parentLayerDocumentId,
        order: placement.order,
        startFrame: placement.startFrame,
        durationFrames: placement.durationFrames,
        endFrameExclusive:
          placement.startFrame + placement.durationFrames,
        sourceOffsetFrames: placement.sourceOffsetFrames,
        visible: placement.visible,
      },
      animation: clonePlainData(layer.common.animation),
      effects: clonePlainData(layer.common.effects),
      modifiers: clonePlainData(layer.common.modifiers),
      typeData: buildTypeData(layer),
      capabilities: buildCapabilities(layer),
    },
  };
}
