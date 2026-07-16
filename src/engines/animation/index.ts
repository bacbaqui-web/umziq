export { useAnimationEngine } from "@/engines/animation/useAnimationEngine";
export type { AnimationCommands, UseAnimationEngineOptions } from "@/engines/animation/useAnimationEngine";
export type { AnimationTargetDescriptor } from "@/engines/animation/models/animationCommandModel";
export { ANIMATABLE_PROPERTIES } from "@/engines/animation/constants/animationConstants";
export {
  getTransformEditMode,
  isAnimatedTransformEdit,
} from "@/engines/animation/models/animationSessionModel";
export type {
  SelectedKeyframe,
  TransformEditMode,
  TransformTargetSelection,
} from "@/engines/animation/models/animationSessionModel";
export {
  findKeyframeAtFrame,
  hasKeyframeAtFrame,
  moveKeyframeValue,
  removeKeyframeValue,
  sortKeyframesByFrame,
  upsertKeyframeValue,
} from "@/engines/animation/helpers/keyframeTrackHelpers";
export {
  getTargetKeyframes,
  isTargetPropertyAnimated,
  replaceTargetKeyframes,
  updateTargetKeyframes,
} from "@/engines/animation/helpers/keyframeTargetHelpers";
export {
  setTargetPropertyTrackEnabled,
  updateTargetPropertyTrack,
} from "@/engines/animation/helpers/propertyTrackHelpers";
export {
  evaluateCompositionOpacity,
  evaluateCompositionPosition,
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerOpacity,
  evaluateLayerPosition,
  evaluateLayerRotation,
  evaluateLayerScale,
  evaluatePositionKeyframes,
  evaluateScalarKeyframes,
  evaluateScaleKeyframes,
} from "@/engines/animation/helpers/animationEvaluationHelpers";
export {
  buildLocalFrameBySourceId,
  getKeyframeGlobalFrame,
  globalFrameToLocalFrame,
  isFrameInsideTimelineItem,
  localFrameToGlobalFrame,
  resolveSelectedTransformLocalFrame,
} from "@/engines/animation/helpers/animationFrameHelpers";
export { buildPositionMotionPathSamples } from "@/engines/animation/helpers/motionPathSamplingHelpers";
export type { MotionPathSample } from "@/engines/animation/helpers/motionPathSamplingHelpers";
export {
  createSelectedKeyframeForTarget,
  createSelectedPropertyKeyframe,
  matchesSelectedPropertyKeyframe,
} from "@/engines/animation/helpers/animationSelectionHelpers";
export {
  clampOpacity,
  normalizeRotationDegrees,
} from "@/engines/animation/helpers/transformValueHelpers";
