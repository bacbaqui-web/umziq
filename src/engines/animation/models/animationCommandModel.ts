import type { Dispatch, SetStateAction } from "react";
import type {
  AnimatableProperty,
  Composition,
  OpacityKeyframe,
  Position,
  PropertyTrackState,
  RotationKeyframe,
  Scale,
  ScaleKeyframe,
} from "@/models";
import type { SelectedKeyframe } from "@/engines/animation/models/animationSessionModel";

export type AnimationTargetDescriptor = {
  kind: "layer" | "composition";
  id: string;
};

export type AnimationProjectPort = {
  updateCompositions: (updater: (current: Composition[]) => Composition[]) => void;
};

export type MasterAnimationPort = {
  setScale: Dispatch<SetStateAction<Scale>>;
  setScaleKeyframes: Dispatch<SetStateAction<ScaleKeyframe[]>>;
  setScaleLinked: Dispatch<SetStateAction<boolean>>;
  setRotation: Dispatch<SetStateAction<number>>;
  setRotationKeyframes: Dispatch<SetStateAction<RotationKeyframe[]>>;
  setOpacity: Dispatch<SetStateAction<number>>;
  setOpacityKeyframes: Dispatch<SetStateAction<OpacityKeyframe[]>>;
  setEnabledProperties: Dispatch<SetStateAction<PropertyTrackState>>;
};

export type AnimationSessionPort = {
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
};

export type AnimationHistoryPort = {
  push: () => void;
  begin: () => void;
  markDirty: () => void;
  commit: () => void;
  cancel?: () => void;
};

export type ApplyAnchorCommand = {
  target: AnimationTargetDescriptor;
  anchor: Position;
  transformOffset: Position;
};

export type PropertyKeyframeCommand = {
  target: AnimationTargetDescriptor;
  property: AnimatableProperty;
  frame: number;
};
