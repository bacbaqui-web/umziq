import {
  LAYER_MODIFIER_DEFINITIONS,
  getLayerModifierDefinition,
} from "@/models";
import type {
  LayerDocumentPropertiesDescriptor,
} from "@/engines/visual/models/layerDocumentPropertiesModel";
import type {
  PropertiesModifierLibraryViewModel,
  PropertiesModifierViewModel,
} from "@/engines/visual/models/propertiesEngineModel";

export function buildModifierPropertiesViewModels(options: {
  descriptor: LayerDocumentPropertiesDescriptor | null;
  drafts: Readonly<Record<string, string | undefined>>;
  mouthAudioOptions?: readonly { id: string; label: string }[];
}): PropertiesModifierViewModel[] {
  const descriptor = options.descriptor;
  if (!descriptor || descriptor.type === "audio") return [];
  return descriptor.modifiers.flatMap((modifier): PropertiesModifierViewModel[] => {
    if (modifier.type === "unknown") return [];
    const definition = getLayerModifierDefinition(modifier.type);
    if (definition.properties.editorKind === "number-fields") {
      return [{
        type: modifier.type,
        label: definition.label,
        fields: definition.properties.fields.map((field) => {
          const id = `modifier.${modifier.type}.${field.field}` as PropertiesModifierViewModel["fields"][number]["id"];
          const value = field.field in modifier
            ? String((modifier as unknown as Record<string, unknown>)[field.field])
            : "0";
          return {
            id,
            field: field.field,
            label: field.label,
            suffix: field.suffix,
            value: options.drafts[id] ?? value,
          };
        }),
      }];
    }
    if (modifier.type === "mouth-basic") return [{
      type: "mouth-basic",
      label: definition.label,
      fields: [],
      audioLayerDocumentId: modifier.audioLayerDocumentId,
      audioOptions: options.mouthAudioOptions ?? [],
      mouthBasicInverted: modifier.inverted === true,
      mouthBasicRepetitionsPerSecond:
        options.drafts[
          "modifier.mouth-basic.repetitionsPerSecond"
        ] ?? String(
          modifier.repetitionsPerSecond ?? 4
        ),
    }];
    if (modifier.type === "acceleration") return [{
      type: "acceleration",
      label: definition.label,
      fields: [],
      accelerationProperties: modifier.properties,
      accelerationCurve: modifier.curve,
    }];
    return [];
  });
}

export function buildModifierPropertiesLibraryViewModel(
  descriptor: LayerDocumentPropertiesDescriptor | null
): PropertiesModifierLibraryViewModel {
  return {
    visible: Boolean(
      descriptor?.type !== "audio" &&
      descriptor?.capabilities.modifiers.status === "editable"
    ),
    items: LAYER_MODIFIER_DEFINITIONS.map((definition) => ({
      type: definition.type,
      label: definition.label,
      active: Boolean(
        descriptor?.modifiers.some((modifier) => modifier.type === definition.type)
      ),
    })),
  };
}
