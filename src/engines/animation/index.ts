export { ANIMATABLE_PROPERTIES } from "@/engines/animation/constants/animationConstants";
export {
  findKeyframeAtFrame,
  hasKeyframeAtFrame,
  moveKeyframeValue,
  removeKeyframeValue,
  sortKeyframesByFrame,
  upsertKeyframeValue,
} from "@/engines/animation/helpers/keyframeTrackHelpers";
export {
  evaluatePositionKeyframes,
  evaluateScalarKeyframes,
  evaluateScaleKeyframes,
} from "@/engines/animation/helpers/animationEvaluationHelpers";
export {
  globalFrameToLocalFrame,
  localFrameToGlobalFrame,
} from "@/engines/animation/helpers/animationFrameHelpers";
export { buildPositionMotionPathSamples } from "@/engines/animation/helpers/motionPathSamplingHelpers";
export type { MotionPathSample } from "@/engines/animation/helpers/motionPathSamplingHelpers";
export {
  clampOpacity,
  normalizeRotationDegrees,
} from "@/engines/animation/helpers/transformValueHelpers";
export {
  MODIFIER_DEFINITIONS,
  createDefaultModifier,
  findModifier,
  getModifierDefinition,
  normalizeModifierInstances,
  normalizeModifierNumber,
  normalizeTargetModifiers,
} from "@/engines/animation/modifiers/modifierRegistry";
export type {
  ModifierDefinition,
  ModifierNumberSettingDefinition,
} from "@/engines/animation/modifiers/modifierRegistry";
export {
  applyPositionModifiers,
  evaluateWiggleOffset,
} from "@/engines/animation/helpers/modifierEvaluationHelpers";
