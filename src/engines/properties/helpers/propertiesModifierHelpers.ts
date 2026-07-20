import type { TransformTargetSelection } from "@/engines/animation";
import type { ModifierNumberField, ModifierType } from "@/models";
import {
  MODIFIER_DEFINITIONS,
  findModifier,
  normalizeModifierInstances,
} from "@/engines/animation";
import type {
  PropertiesModifierInputId,
  PropertiesModifierLibraryViewModel,
  PropertiesModifierViewModel,
} from "@/engines/properties/models/propertiesEngineModel";
import type { PropertiesDraftControllerPort } from "@/engines/properties/models/propertiesInternalModel";

export function getModifierInputId(
  type: ModifierType,
  field: ModifierNumberField
): PropertiesModifierInputId {
  return `modifier.${type}.${field}` as PropertiesModifierInputId;
}

export function getModifierInputDescriptor(inputId: PropertiesModifierInputId) {
  const [, type, field] = inputId.split(".") as [
    "modifier",
    ModifierType,
    ModifierNumberField,
  ];
  return { type, field };
}

export function buildPropertiesModifierViewModel(options: {
  target: TransformTargetSelection;
  masterCompId: string;
  draft: PropertiesDraftControllerPort;
}): {
  modifiers: PropertiesModifierViewModel[];
  library: PropertiesModifierLibraryViewModel;
} {
  if (
    !options.target
    || (options.target.kind === "composition"
      && options.target.composition.id === options.masterCompId)
  ) {
    return { modifiers: [], library: { visible: false, items: [] } };
  }

  const target = options.target.kind === "layer"
    ? options.target.layer
    : options.target.composition;
  const modifiers = normalizeModifierInstances(target.modifiers, target.id);

  return {
    modifiers: MODIFIER_DEFINITIONS.flatMap((definition) => {
      const modifier = findModifier(modifiers, definition.type);
      if (!modifier) return [];
      return [{
        type: definition.type,
        label: definition.label,
        fields: definition.settings.map((setting) => {
          const id = getModifierInputId(definition.type, setting.field);
          return {
            id,
            field: setting.field,
            label: setting.label,
            value: options.draft.getNumericDraft(id)
              ?? String(
                setting.field === "frequency"
                  ? modifier.frequency
                  : modifier.amount
              ),
          };
        }),
      }];
    }),
    library: {
      visible: true,
      items: MODIFIER_DEFINITIONS.map((definition) => ({
        type: definition.type,
        label: definition.label,
        active: !!findModifier(modifiers, definition.type),
      })),
    },
  };
}
