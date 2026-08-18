import type {
  AnimatableProperty,
  LayerDocumentTimelineIntent,
} from "@/models";
import type { PreviewSceneTransformPatch } from "@/render";
import type {
  LayerDocumentPropertiesCommand,
  LayerDocumentPropertiesDescriptorResult,
} from "@/engines/properties/models/layerDocumentPropertiesModel";
import type { LayerTransform } from "@/models";

export interface LayerDocumentPropertiesReadContext {
  readonly descriptor: LayerDocumentPropertiesDescriptorResult;
  readonly globalFrame: number;
  readonly localFrame: number | null;
  readonly displayedTransform: LayerTransform | null;
}

export interface LayerDocumentPropertiesCommandPort {
  readonly read: () => LayerDocumentPropertiesReadContext;
  readonly preview: (
    layerDocumentId: string,
    patch: PreviewSceneTransformPatch
  ) => { readonly ok: true } | { readonly ok: false };
  readonly commit: () => { readonly ok: boolean } | null;
  readonly cancel: () => void;
  readonly dispatchPanel: (
    command: LayerDocumentPropertiesCommand
  ) => { readonly ok: boolean };
  readonly dispatchTimeline: (
    intent: LayerDocumentTimelineIntent
  ) => { readonly ok: boolean };
  readonly selectKeyframe: (
    selection: {
      readonly layerDocumentId: string;
      readonly property: AnimatableProperty;
      readonly localFrame: number;
      readonly globalFrame: number;
    } | null
  ) => unknown;
  readonly readSelectedKeyframe: () => {
    readonly layerDocumentId: string;
    readonly property: AnimatableProperty;
    readonly localFrame: number;
    readonly globalFrame: number;
  } | null;
}
