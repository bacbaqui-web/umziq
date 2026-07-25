import type {
  LayerDocumentType,
} from "@/models";
import type {
  EditorPlaceholderDescriptor,
} from "@/engines/playback-render/models/editorPlaceholderModel";

const PLACEHOLDER_BY_TYPE: Readonly<
  Record<
    "drawing" | "text" | "audio",
    EditorPlaceholderDescriptor
  >
> = {
  drawing: {
    placeholderKind: "drawing",
    label: null,
    fill: "#747980",
    textColor: "#f5f7f9",
    size: { width: 240, height: 160 },
  },
  text: {
    placeholderKind: "text",
    label: "TEXT",
    fill: "#39414b",
    textColor: "#ffffff",
    size: { width: 320, height: 120 },
  },
  audio: {
    placeholderKind: "audio",
    label: "AUDIO",
    fill: "#30363d",
    textColor: "#d7e7f7",
    size: { width: 320, height: 96 },
  },
};

export function getEditorPlaceholderDescriptorForLayerType(
  layerType: LayerDocumentType
): EditorPlaceholderDescriptor | null {
  return layerType === "drawing" ||
    layerType === "text" ||
    layerType === "audio"
    ? PLACEHOLDER_BY_TYPE[layerType]
    : null;
}
