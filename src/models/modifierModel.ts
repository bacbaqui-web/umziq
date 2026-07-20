export type ModifierType = "wiggle";

export type WiggleModifierField = "frequency" | "amount";

export type WiggleModifierInstance = {
  id: string;
  type: "wiggle";
  frequency: number;
  amount: number;
};

export type ModifierInstance = WiggleModifierInstance;
export type ModifierNumberField = WiggleModifierField;
