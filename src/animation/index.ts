export { ANIMATABLE_PROPERTIES } from "@/animation/constants/animationConstants";
export {
  findKeyframeAtFrame,
  hasKeyframeAtFrame,
  moveKeyframeValue,
  removeKeyframeValue,
  sortKeyframesByFrame,
  upsertKeyframeValue,
} from "@/animation/helpers/keyframeTrackHelpers";
export {
  evaluatePositionKeyframes,
  evaluateScalarKeyframes,
  evaluateScaleKeyframes,
} from "@/animation/helpers/animationEvaluationHelpers";
export {
  globalFrameToLocalFrame,
  localFrameToGlobalFrame,
} from "@/animation/helpers/animationFrameHelpers";
export { buildPositionMotionPathSamples } from "@/animation/helpers/motionPathSamplingHelpers";
export type { MotionPathSample } from "@/animation/helpers/motionPathSamplingHelpers";
export {
  clampOpacity,
  normalizeRotationDegrees,
} from "@/animation/helpers/transformValueHelpers";
export {
  MODIFIER_DEFINITIONS,
  createDefaultModifier,
  findModifier,
  getModifierDefinition,
  normalizeModifierInstances,
  normalizeModifierNumber,
  normalizeTargetModifiers,
} from "@/animation/modifiers/modifierRegistry";
export type {
  ModifierDefinition,
  ModifierNumberSettingDefinition,
} from "@/animation/modifiers/modifierRegistry";
export {
  applyPositionModifiers,
  applyRotationModifiers,
  evaluateWiggleOffset,
} from "@/animation/helpers/modifierEvaluationHelpers";
export {
  analyzeMouthBasicTransitions,
  evaluateMouthBasicOpacity,
  type MouthBasicAudioBuffer,
} from "@/animation/modifiers/mouthBasicAnalysis";
export { evaluateAccelerationProgress, remapAccelerationFrame } from "@/animation/modifiers/accelerationEvaluation";
