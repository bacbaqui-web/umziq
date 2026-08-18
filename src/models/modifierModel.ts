export type ModifierType = "wiggle" | "swing" | "oscillate" | "mouth-basic" | "acceleration";
export type AccelerationCurve = "ease-out-soft" | "ease-out-strong" | "ease-in-soft" | "ease-in-strong";

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

export type MouthBasicModifierInstance = {
  id: string;
  type: "mouth-basic";
  audioLayerDocumentId: string | null;
  startFrame: number;
  durationFrames: number;
  transitionFrames: number[];
};

export type AccelerationModifierInstance = {
  id: string;
  type: "acceleration";
  properties: ("position" | "scale" | "rotation" | "opacity")[];
  curve: AccelerationCurve;
  startFrame: number;
  durationFrames: number;
};

export type ModifierInstance =
  | WiggleModifierInstance
  | SwingModifierInstance
  | OscillateModifierInstance
  | MouthBasicModifierInstance
  | AccelerationModifierInstance;
export type ModifierNumberField = OscillateModifierField;
