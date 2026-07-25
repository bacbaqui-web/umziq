import type {
  ModifierNumberField,
  ModifierType,
} from "@/models";
import type {
  PropertiesModifierInputId,
} from "@/engines/properties/models/propertiesEngineModel";

export function getModifierInputDescriptor(
  inputId: PropertiesModifierInputId
) {
  const [, type, field] = inputId.split(".") as [
    "modifier",
    ModifierType,
    ModifierNumberField,
  ];
  return { type, field };
}
