export type ModifierType = "wiggle" | "swing" | "oscillate";

export type WiggleModifierField = "frequency" | "amount";
export type OscillateModifierField = WiggleModifierField | "angle";

export type WiggleModifierInstance = {
  id: string;
  type: "wiggle";
  frequency: number;
  amount: number;
};

export type SwingModifierInstance = {
  id: string;
  type: "swing";
  frequency: number;
  amount: number;
};

export type OscillateModifierInstance = {
  id: string;
  type: "oscillate";
  angle: number;
  frequency: number;
  amount: number;
};

export type ModifierInstance =
  | WiggleModifierInstance
  | SwingModifierInstance
  | OscillateModifierInstance;
export type ModifierNumberField = OscillateModifierField;
