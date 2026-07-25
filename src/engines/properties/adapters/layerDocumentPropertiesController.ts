import type {
  AnimatableProperty,
  LayerAnimation,
  LayerDocumentTimelineIntent,
  LayerModifier,
  LayerTransform,
} from "@/models";
import { upsertKeyframeValue } from "@/models/keyframeTrackMutation";
import type {
  PreviewSceneTransformPatch,
} from "@/engines/playback-render";
import {
  applyLinkedScaleInput,
  applyPositionInput,
  clampPropertiesNumericValue,
  formatPropertiesNumericValue,
  getPropertiesNumericInputDescriptor,
  parsePropertiesNumericDraft,
} from "@/engines/properties/helpers/propertiesNumericHelpers";
import { getModifierInputDescriptor } from "@/engines/properties/helpers/propertiesModifierHelpers";
import type {
  LayerDocumentPanelCommand,
  LayerDocumentPanelDescriptor,
  LayerDocumentPanelDescriptorResult,
} from "@/engines/properties/models/layerDocumentPanelModel";
import type {
  PropertiesDraftInputId,
  PropertiesModifierInputId,
  PropertiesNumericInputId,
} from "@/engines/properties/models/propertiesEngineModel";
import {
  getCompensatedTransformOffset,
} from "@/shared/geometry/transformOffsetHelpers";

export interface LayerDocumentPropertiesRuntimeState {
  readonly selectedLayerDocumentId: string | null;
  readonly selectedLayerRevision: number | null;
  readonly globalFrame: number;
  readonly localFrame: number | null;
  readonly focusedInputId: PropertiesDraftInputId | null;
  readonly focusedTransform: LayerTransform | null;
  readonly inputDrafts: Partial<Record<PropertiesDraftInputId, string>>;
}

export interface LayerDocumentPropertiesRuntimePort {
  readonly read: () => LayerDocumentPropertiesRuntimeState;
  readonly replace: (state: LayerDocumentPropertiesRuntimeState) => void;
}

/**
 * The cutover side evaluates this context at the injected Timeline frame:
 * global frame -> placement local frame -> animation/modifiers -> matching
 * common Draft snapshot. The Properties engine intentionally cannot import
 * the cutover assembly.
 */
export interface LayerDocumentPropertiesReadContext {
  readonly descriptor: LayerDocumentPanelDescriptorResult;
  readonly globalFrame: number;
  readonly localFrame: number | null;
  readonly displayedTransform: LayerTransform | null;
}

export interface LayerDocumentPropertiesCommandPort {
  readonly read: () => LayerDocumentPropertiesReadContext;
  readonly preview: (
    layerDocumentId: string,
    patch: PreviewSceneTransformPatch
  ) => { readonly ok: true } | { readonly ok: false };
  readonly commit: () => { readonly ok: boolean } | null;
  readonly cancel: () => void;
  readonly dispatchPanel: (
    command: LayerDocumentPanelCommand
  ) => { readonly ok: boolean };
  readonly dispatchTimeline: (
    intent: LayerDocumentTimelineIntent
  ) => { readonly ok: boolean };
  readonly selectKeyframe: (
    selection: {
      readonly layerDocumentId: string;
      readonly property: AnimatableProperty;
      readonly localFrame: number;
      readonly globalFrame: number;
    } | null
  ) => unknown;
  readonly readSelectedKeyframe: () => {
    readonly layerDocumentId: string;
    readonly property: AnimatableProperty;
    readonly localFrame: number;
    readonly globalFrame: number;
  } | null;
}

function emptyRuntime(
  descriptor: LayerDocumentPanelDescriptor | null,
  globalFrame: number,
  localFrame: number | null
): LayerDocumentPropertiesRuntimeState {
  return {
    selectedLayerDocumentId: descriptor?.layerDocumentId ?? null,
    selectedLayerRevision: descriptor?.revision ?? null,
    globalFrame,
    localFrame,
    focusedInputId: null,
    focusedTransform: null,
    inputDrafts: {},
  };
}

function readyDescriptor(
  result: LayerDocumentPanelDescriptorResult
) {
  return result.status === "ready" ? result.descriptor : null;
}

function cloneTransform(transform: LayerTransform): LayerTransform {
  return {
    ...transform,
    position: { ...transform.position },
    transformOffset: { ...transform.transformOffset },
    anchor: { ...transform.anchor },
    scale: { ...transform.scale },
  };
}

function numericValue(
  transform: LayerTransform,
  inputId: PropertiesNumericInputId
) {
  const { property, axis } =
    getPropertiesNumericInputDescriptor(inputId);
  if (property === "position" && axis !== "value") {
    return transform.position[axis];
  }
  if (property === "scale" && axis !== "value") {
    return transform.scale[axis];
  }
  if (property === "anchor" && axis !== "value") {
    return transform.anchor[axis];
  }
  return property === "rotation"
    ? transform.rotation
    : transform.opacity;
}

function patchForNumericValue(
  transform: LayerTransform,
  inputId: PropertiesNumericInputId,
  rawValue: string
): PreviewSceneTransformPatch | null {
  const parsed = parsePropertiesNumericDraft(rawValue);
  if (parsed.kind !== "number") return null;
  const { property, axis } =
    getPropertiesNumericInputDescriptor(inputId);
  const value = clampPropertiesNumericValue(property, parsed.value);
  if (property === "position" && axis !== "value") {
    return {
      position: applyPositionInput(transform.position, axis, value),
    };
  }
  if (property === "scale" && axis !== "value") {
    return {
      scale: applyLinkedScaleInput(
        transform.scale,
        axis,
        value,
        transform.scaleLinked
      ),
    };
  }
  if (property === "anchor" && axis !== "value") {
    const anchor = applyPositionInput(transform.anchor, axis, value);
    return {
      anchor,
      transformOffset: getCompensatedTransformOffset(
        transform.transformOffset,
        transform.anchor,
        anchor,
        transform.scale,
        transform.rotation
      ),
    };
  }
  if (property === "rotation") return { rotation: value };
  return { opacity: value };
}

function patchChanged(
  transform: LayerTransform,
  patch: PreviewSceneTransformPatch
) {
  return (
    (
      patch.position !== undefined &&
      (
        patch.position.x !== transform.position.x ||
        patch.position.y !== transform.position.y
      )
    ) ||
    (
      patch.scale !== undefined &&
      (
        patch.scale.x !== transform.scale.x ||
        patch.scale.y !== transform.scale.y
      )
    ) ||
    (
      patch.anchor !== undefined &&
      (
        patch.anchor.x !== transform.anchor.x ||
        patch.anchor.y !== transform.anchor.y
      )
    ) ||
    (
      patch.transformOffset !== undefined &&
      (
        patch.transformOffset.x !== transform.transformOffset.x ||
        patch.transformOffset.y !== transform.transformOffset.y
      )
    ) ||
    (
      patch.rotation !== undefined &&
      patch.rotation !== transform.rotation
    ) ||
    (
      patch.opacity !== undefined &&
      patch.opacity !== transform.opacity
    )
  );
}

function numericInputEditable(
  descriptor: LayerDocumentPanelDescriptor,
  inputId: PropertiesNumericInputId
) {
  const { property } =
    getPropertiesNumericInputDescriptor(inputId);
  return descriptor.capabilities.transformInputs[property].status ===
    "editable";
}

function modifierForInput(
  descriptor: LayerDocumentPanelDescriptor,
  inputId: PropertiesModifierInputId
) {
  const { type } = getModifierInputDescriptor(inputId);
  return descriptor.modifiers.find(
    (modifier): modifier is Extract<LayerModifier, { type: "wiggle" }> =>
      modifier.type === type
  ) ?? null;
}

function normalizeModifierNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function animationWithTrack(
  animation: LayerAnimation,
  transform: LayerTransform,
  property: AnimatableProperty,
  enabled: boolean,
  localFrame: number
): LayerAnimation {
  const next: LayerAnimation = {
    ...animation,
    positionKeyframes: [...animation.positionKeyframes],
    scaleKeyframes: [...animation.scaleKeyframes],
    rotationKeyframes: [...animation.rotationKeyframes],
    opacityKeyframes: [...animation.opacityKeyframes],
    enabledProperties: {
      ...animation.enabledProperties,
      [property]: enabled,
    },
  };
  if (!enabled) return next;
  if (property === "position") {
    next.positionKeyframes = upsertKeyframeValue(
      next.positionKeyframes,
      localFrame,
      transform.position
    );
  } else if (property === "scale") {
    next.scaleKeyframes = upsertKeyframeValue(
      next.scaleKeyframes,
      localFrame,
      transform.scale
    );
  } else if (property === "rotation") {
    next.rotationKeyframes = upsertKeyframeValue(
      next.rotationKeyframes,
      localFrame,
      transform.rotation
    );
  } else {
    next.opacityKeyframes = upsertKeyframeValue(
      next.opacityKeyframes,
      localFrame,
      transform.opacity
    );
  }
  return next;
}

export function createLayerDocumentPropertiesController(options: {
  port: LayerDocumentPropertiesCommandPort;
  runtime: LayerDocumentPropertiesRuntimePort;
}) {
  const readScope = () => {
    const context = options.port.read();
    return {
      context,
      descriptor: readyDescriptor(context.descriptor),
    };
  };
  const replaceEmpty = () => {
    const { context, descriptor } = readScope();
    options.runtime.replace(
      emptyRuntime(descriptor, context.globalFrame, context.localFrame)
    );
  };
  const syncSelection = () => {
    const { context, descriptor } = readScope();
    const state = options.runtime.read();
    if (
      state.selectedLayerDocumentId ===
        (descriptor?.layerDocumentId ?? null) &&
      state.selectedLayerRevision === (descriptor?.revision ?? null) &&
      state.globalFrame === context.globalFrame &&
      state.localFrame === context.localFrame
    ) return false;
    options.port.cancel();
    options.runtime.replace(
      emptyRuntime(descriptor, context.globalFrame, context.localFrame)
    );
    return true;
  };
  const dispatch = (command: LayerDocumentPanelCommand) =>
    options.port.dispatchPanel(command);

  const focusNumericInput = (inputId: PropertiesNumericInputId) => {
    syncSelection();
    const { context, descriptor } = readScope();
    const transform = context.displayedTransform;
    if (
      !descriptor ||
      !transform ||
      !numericInputEditable(descriptor, inputId)
    ) return false;
    const { property } =
      getPropertiesNumericInputDescriptor(inputId);
    options.runtime.replace({
      selectedLayerDocumentId: descriptor.layerDocumentId,
      selectedLayerRevision: descriptor.revision,
      globalFrame: context.globalFrame,
      localFrame: context.localFrame,
      focusedInputId: inputId,
      focusedTransform: cloneTransform(transform),
      inputDrafts: {
        [inputId]: formatPropertiesNumericValue(
          property,
          numericValue(transform, inputId)
        ),
      },
    });
    return true;
  };

  const changeNumericInput = (
    inputId: PropertiesNumericInputId,
    value: string
  ) => {
    syncSelection();
    const state = options.runtime.read();
    if (
      state.focusedInputId !== inputId ||
      parsePropertiesNumericDraft(value).kind === "invalid"
    ) return null;
    options.runtime.replace({
      ...state,
      inputDrafts: { ...state.inputDrafts, [inputId]: value },
    });
    const { descriptor } = readScope();
    if (!descriptor || !state.focusedTransform) return null;
    const patch = patchForNumericValue(
      state.focusedTransform,
      inputId,
      value
    );
    if (!patch || !patchChanged(state.focusedTransform, patch)) {
      options.port.cancel();
      return { ok: true as const, changed: false };
    }
    const result = options.port.preview(descriptor.layerDocumentId, patch);
    return result.ok
      ? { ok: true as const, changed: true }
      : { ok: false as const, reason: "preview-failed" as const };
  };

  const commitNumericInput = (inputId: PropertiesNumericInputId) => {
    syncSelection();
    const state = options.runtime.read();
    const { descriptor } = readScope();
    const rawValue = state.inputDrafts[inputId];
    if (
      state.focusedInputId !== inputId ||
      !descriptor ||
      !state.focusedTransform ||
      rawValue === undefined
    ) return null;
    const patch = patchForNumericValue(
      state.focusedTransform,
      inputId,
      rawValue
    );
    if (!patch || !patchChanged(state.focusedTransform, patch)) {
      options.port.cancel();
      replaceEmpty();
      return { ok: true as const, committed: false };
    }
    const preview = options.port.preview(
      descriptor.layerDocumentId,
      patch
    );
    if (!preview.ok) {
      return { ok: false as const, reason: "preview-failed" as const };
    }
    const committed = options.port.commit();
    if (!committed?.ok) {
      return {
        ok: false as const,
        reason: "commit-failed" as const,
      };
    }
    replaceEmpty();
    return { ok: true as const, committed: true };
  };

  const cancelInput = (inputId: PropertiesDraftInputId) => {
    if (options.runtime.read().focusedInputId !== inputId) return false;
    options.port.cancel();
    replaceEmpty();
    return true;
  };

  const focusModifierInput = (inputId: PropertiesModifierInputId) => {
    syncSelection();
    const { context, descriptor } = readScope();
    if (
      !descriptor ||
      descriptor.capabilities.modifiers.status !== "editable"
    ) return false;
    const modifier = modifierForInput(descriptor, inputId);
    if (!modifier) return false;
    const { field } = getModifierInputDescriptor(inputId);
    options.runtime.replace({
      selectedLayerDocumentId: descriptor.layerDocumentId,
      selectedLayerRevision: descriptor.revision,
      globalFrame: context.globalFrame,
      localFrame: context.localFrame,
      focusedInputId: inputId,
      focusedTransform: null,
      inputDrafts: {
        [inputId]: String(modifier[field]),
      },
    });
    return true;
  };

  const changeModifierInput = (
    inputId: PropertiesModifierInputId,
    value: string
  ) => {
    syncSelection();
    const state = options.runtime.read();
    if (
      state.focusedInputId !== inputId ||
      parsePropertiesNumericDraft(value).kind === "invalid"
    ) return false;
    options.runtime.replace({
      ...state,
      inputDrafts: { ...state.inputDrafts, [inputId]: value },
    });
    return true;
  };

  const commitModifierInput = (inputId: PropertiesModifierInputId) => {
    syncSelection();
    const state = options.runtime.read();
    const { descriptor } = readScope();
    const raw = state.inputDrafts[inputId];
    const parsed = raw === undefined
      ? { kind: "invalid" as const }
      : parsePropertiesNumericDraft(raw);
    const modifier = descriptor
      ? modifierForInput(descriptor, inputId)
      : null;
    if (
      state.focusedInputId !== inputId ||
      !descriptor ||
      !modifier ||
      parsed.kind !== "number"
    ) return null;
    const { field } = getModifierInputDescriptor(inputId);
    const value = normalizeModifierNumber(parsed.value);
    if (modifier[field] === value) {
      replaceEmpty();
      return { ok: true as const, committed: false };
    }
    const modifiers = descriptor.modifiers.map((candidate) =>
      candidate.modifierId === modifier.modifierId
        ? { ...candidate, [field]: value }
        : candidate
    );
    const result = dispatch({
      kind: "set-modifiers",
      layerDocumentId: descriptor.layerDocumentId,
      modifiers,
    });
    if (!result.ok) {
      return {
        ok: false as const,
        reason: "dispatch-failed" as const,
      };
    }
    replaceEmpty();
    return { ok: true as const, committed: true };
  };

  return {
    read: () => ({
      ...options.port.read(),
      runtime: options.runtime.read(),
    }),
    readSelectedKeyframe:
      options.port.readSelectedKeyframe,
    syncSelection,
    focusNumericInput,
    changeNumericInput,
    blurNumericInput: commitNumericInput,
    keyDownNumericInput: (
      inputId: PropertiesNumericInputId,
      key: string
    ) => {
      if (key === "Enter") {
        commitNumericInput(inputId);
        return "blur" as const;
      }
      if (key === "Escape") {
        cancelInput(inputId);
        return "blur" as const;
      }
      return null;
    },
    focusModifierInput,
    changeModifierInput,
    blurModifierInput: commitModifierInput,
    keyDownModifierInput: (
      inputId: PropertiesModifierInputId,
      key: string
    ) => {
      if (key === "Enter") {
        commitModifierInput(inputId);
        return "blur" as const;
      }
      if (key === "Escape") {
        cancelInput(inputId);
        return "blur" as const;
      }
      return null;
    },
    togglePropertyTrack: (
      property: AnimatableProperty,
      enabled: boolean
    ) => {
      syncSelection();
      const { context, descriptor } = readScope();
      if (
        !descriptor ||
        !context.displayedTransform ||
        context.localFrame === null ||
        descriptor.capabilities.animation.status !== "editable" ||
        descriptor.capabilities.transformInputs[property].status !==
          "editable" ||
        descriptor.animation.enabledProperties[property] === enabled
      ) return null;
      const result = dispatch({
        kind: "set-animation",
        layerDocumentId: descriptor.layerDocumentId,
        animation: animationWithTrack(
          descriptor.animation,
          context.displayedTransform,
          property,
          enabled,
          context.localFrame
        ),
      });
      if (result.ok) {
        const selected = options.port.readSelectedKeyframe();
        if (enabled) {
          options.port.selectKeyframe({
            layerDocumentId: descriptor.layerDocumentId,
            property,
            localFrame: context.localFrame,
            globalFrame: context.globalFrame,
          });
        } else if (
          selected?.layerDocumentId === descriptor.layerDocumentId &&
          selected.property === property
        ) {
          options.port.selectKeyframe(null);
        }
      }
      return result;
    },
    toggleScaleLink: () => {
      syncSelection();
      const { context, descriptor } = readScope();
      if (
        !descriptor ||
        !context.displayedTransform ||
        !numericInputEditable(descriptor, "scale.x")
      ) return null;
      return dispatch({
        kind: "set-scale-linked",
        layerDocumentId: descriptor.layerDocumentId,
        scaleLinked: !context.displayedTransform.scaleLinked,
      });
    },
    savePositionKeyframe: () => {
      syncSelection();
      const { context, descriptor } = readScope();
      if (
        !descriptor ||
        !context.displayedTransform ||
        context.localFrame === null ||
        descriptor.capabilities.animation.status !== "editable"
      ) return null;
      const result = dispatch({
        kind: "upsert-position-keyframe",
        layerDocumentId: descriptor.layerDocumentId,
        localFrame: context.localFrame,
        value: context.displayedTransform.position,
      });
      if (result.ok) {
        options.port.selectKeyframe({
          layerDocumentId: descriptor.layerDocumentId,
          property: "position",
          localFrame: context.localFrame,
          globalFrame: context.globalFrame,
        });
      }
      return result;
    },
    deleteSelectedKeyframe: () => {
      syncSelection();
      const descriptor =
        readyDescriptor(options.port.read().descriptor);
      const keyframe = options.port.readSelectedKeyframe();
      if (
        !descriptor ||
        !keyframe ||
        keyframe.layerDocumentId !== descriptor.layerDocumentId
      ) return null;
      return options.port.dispatchTimeline({
        kind: "remove-keyframe",
        layerDocumentId: keyframe.layerDocumentId,
        property: keyframe.property,
        localFrame: keyframe.localFrame,
      });
    },
    toggleModifier: (type: "wiggle") => {
      syncSelection();
      const { descriptor } = readScope();
      if (
        !descriptor ||
        descriptor.capabilities.modifiers.status !== "editable"
      ) return null;
      const existing = descriptor.modifiers.find(
        (modifier) => modifier.type === type
      );
      const modifiers = existing
        ? descriptor.modifiers.filter(
            (modifier) => modifier.modifierId !== existing.modifierId
          )
        : [
            ...descriptor.modifiers,
            {
              modifierId: `${type}:${descriptor.layerDocumentId}`,
              type,
              enabled: true,
              frequency: 0,
              amount: 0,
            },
          ];
      return dispatch({
        kind: "set-modifiers",
        layerDocumentId: descriptor.layerDocumentId,
        modifiers,
      });
    },
    previewTransform: (patch: PreviewSceneTransformPatch) => {
      syncSelection();
      const descriptor =
        readyDescriptor(options.port.read().descriptor);
      return descriptor
        ? options.port.preview(descriptor.layerDocumentId, patch)
        : null;
    },
    commitTransformPreview: () => options.port.commit(),
    cancelTransformPreview: () => options.port.cancel(),
    setAnimation: (animation: LayerAnimation) => {
      const descriptor =
        readyDescriptor(options.port.read().descriptor);
      return descriptor
        ? dispatch({
            kind: "set-animation",
            layerDocumentId: descriptor.layerDocumentId,
            animation,
          })
        : null;
    },
    setModifiers: (modifiers: LayerModifier[]) => {
      const descriptor =
        readyDescriptor(options.port.read().descriptor);
      return descriptor
        ? dispatch({
            kind: "set-modifiers",
            layerDocumentId: descriptor.layerDocumentId,
            modifiers,
          })
        : null;
    },
    dispatch,
  };
}
