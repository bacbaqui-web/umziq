import type {
  LayerDocumentPropertiesCapability,
  LayerDocumentPropertiesDescriptor,
} from "@/engines/properties/models/layerDocumentPropertiesModel";
import type {
  PropertiesCapabilityViewModel,
  PropertiesInfoViewModel,
  PropertiesSourceDetailViewModel,
  PropertiesSourceHeaderViewModel,
} from "@/engines/properties/models/propertiesEngineModel";

export const PROPERTIES_TYPE_LABELS: Readonly<Record<
  LayerDocumentPropertiesDescriptor["type"],
  string
>> = {
  psd: "PSD",
  drawing: "Drawing",
  text: "Text",
  audio: "Audio",
  video: "Video",
  shape: "Shape",
  group: "Group",
  unknown: "Unknown",
};

function capabilityStatus(
  value: LayerDocumentPropertiesCapability["status"]
): PropertiesCapabilityViewModel["status"] {
  return value === "future" ? "unsupported" : value;
}

function capabilityView(
  key: PropertiesCapabilityViewModel["key"],
  label: string,
  value: LayerDocumentPropertiesCapability
): PropertiesCapabilityViewModel {
  const status = capabilityStatus(value.status);
  return {
    key,
    label,
    status,
    statusLabel: status === "editable"
      ? "편집 가능"
      : status === "read-only" ? "읽기 전용" : "미지원",
    description: value.reason,
  };
}

export function buildPropertiesSourceDetail(
  descriptor: LayerDocumentPropertiesDescriptor
): PropertiesSourceDetailViewModel {
  const typeData = descriptor.typeData;
  if (typeData.kind === "psd") {
    return {
      title: "PSD source",
      description: "PSD pixels are owned by Source Registry.",
      fields: [{
        label: "Source",
        value: descriptor.source.displayName ?? descriptor.source.sourceId ?? "Unresolved",
      }],
    };
  }
  if (typeData.kind === "drawing") {
    return {
      title: "Drawing document",
      description: "LayerDocument Drawing data.",
      fields: [
        { label: "요소", value: `${typeData.data.elements.length}개` },
        { label: "문서 버전", value: String(typeData.data.documentVersion) },
      ],
    };
  }
  if (typeData.kind === "text") {
    return {
      title: "Text content",
      description: "LayerDocument Text data.",
      fields: [
        { label: "텍스트", value: typeData.data.text || "(빈 텍스트)" },
        {
          label: "스타일",
          value: `${typeData.data.style.fontFamily} · ${typeData.data.style.fontSize}px · ${typeData.data.style.color}`,
        },
      ],
    };
  }
  if (typeData.kind === "audio" || typeData.kind === "video") {
    return {
      title: `${PROPERTIES_TYPE_LABELS[typeData.kind]} source`,
      description: "Domain data schema is currently empty.",
      fields: [{ label: "상태", value: "Future placeholder" }],
    };
  }
  if (typeData.kind === "shape") {
    return {
      title: "Shape document",
      description: "Shape editing is not connected yet.",
      fields: [{ label: "도형", value: `${typeData.data.shapes.length}개` }],
    };
  }
  if (typeData.kind === "group") {
    return {
      title: descriptor.isProjectRoot ? "Project root" : "Group composition",
      description: "LayerDocument Group metadata.",
      fields: [
        { label: "Canvas", value: `${typeData.data.width} × ${typeData.data.height}` },
        { label: "Duration", value: `${typeData.data.durationFrames} frames` },
      ],
    };
  }
  return {
    title: "Unknown Layer",
    description: "Unknown domain data is preserved read-only.",
    fields: [{ label: "원본 Type", value: typeData.data.originalType }],
  };
}

export function buildPropertiesSourceHeader(
  descriptor: LayerDocumentPropertiesDescriptor
): PropertiesSourceHeaderViewModel {
  return {
    itemId: descriptor.layerDocumentId,
    sourceId: descriptor.source.sourceId ?? descriptor.layerDocumentId,
    sourceName: descriptor.source.displayName ?? descriptor.name,
    itemAlias: descriptor.alias,
    displayName: descriptor.displayName,
    type: descriptor.type,
    typeLabel: PROPERTIES_TYPE_LABELS[descriptor.type],
    entityKind: descriptor.type === "group" ? "composition" : "layer",
    availabilityLabel: descriptor.source.referenceStatus === "none"
      ? "내장 데이터"
      : descriptor.source.resolutionStatus === "available" ? "사용 가능" : "누락",
  };
}

export function buildPropertiesCapabilities(
  descriptor: LayerDocumentPropertiesDescriptor
): PropertiesCapabilityViewModel[] {
  return [
    capabilityView(
      "transform",
      "Visual Transform",
      descriptor.isProjectRoot
        ? {
            status: "editable",
            reason: "Scale, Rotation, and Opacity are editable; Position and Anchor remain project-owned.",
          }
        : descriptor.capabilities.transform
    ),
    capabilityView("animation", "Animation", descriptor.capabilities.animation),
    capabilityView("content", "Content", descriptor.capabilities.domain),
  ];
}

export function buildPropertiesInfo(
  descriptor: LayerDocumentPropertiesDescriptor
): PropertiesInfoViewModel | null {
  if (descriptor.typeData.kind !== "group") return null;
  return {
    name: descriptor.displayName,
    sourceFileName: descriptor.source.displayName ?? "-",
    canvasSize: `${descriptor.typeData.data.width} x ${descriptor.typeData.data.height}`,
    duration: `${(
      descriptor.typeData.data.durationFrames / descriptor.typeData.data.frameRate
    ).toFixed(1)}s`,
  };
}
