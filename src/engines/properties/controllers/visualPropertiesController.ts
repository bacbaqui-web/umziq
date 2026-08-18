import { useEffect, useMemo, useState } from "react";
import type {
  AnimatableProperty,
  LayerAnimation,
  LayerTransform,
} from "@/models";
import type { PreviewSceneTransformPatch } from "@/render";
import {
  buildPropertiesAnimationWithTrack,
  buildPropertiesTransformPatch,
  clonePropertiesTransform,
  hasPropertiesTransformPatchChanged,
  isPropertiesNumericInputEditable,
  readPropertiesNumericValue,
} from "@/engines/properties/helpers/visualPropertiesHelpers";
import {
  formatPropertiesNumericValue,
  getPropertiesNumericInputDescriptor,
  parsePropertiesNumericDraft,
} from "@/engines/properties/helpers/propertiesNumericHelpers";
import { readyPropertiesDescriptor } from "@/engines/properties/helpers/propertiesSelectionHelpers";
import type {
  LayerDocumentPropertiesCommandPort,
} from "@/engines/properties/models/propertiesControllerModel";
import type {
  PropertiesNumericDraftController,
} from "@/engines/properties/models/propertiesNumericDraftModel";
import type {
  PropertiesNumericInputId,
} from "@/engines/properties/models/propertiesEngineModel";

export interface VisualPropertiesRuntimeState {
  readonly scopeIdentity: string;
  readonly focusedTransform: LayerTransform | null;
}

export interface VisualPropertiesRuntimePort {
  readonly read: () => VisualPropertiesRuntimeState;
  readonly replace: (state: VisualPropertiesRuntimeState) => void;
}

export function createVisualPropertiesController(options: {
  port: LayerDocumentPropertiesCommandPort;
  draft: PropertiesNumericDraftController;
  runtime: VisualPropertiesRuntimePort;
  readScopeIdentity: () => string;
}) {
  const readScope = () => {
    const context = options.port.read();
    return {
      context,
      descriptor: readyPropertiesDescriptor(context.descriptor),
    };
  };
  const syncSelection = () => {
    const scopeIdentity = options.readScopeIdentity();
    const draftChanged = options.draft.syncScope(scopeIdentity);
    if (options.runtime.read().scopeIdentity === scopeIdentity) {
      return draftChanged;
    }
    options.port.cancel();
    options.runtime.replace({ scopeIdentity, focusedTransform: null });
    return true;
  };
  const clearSession = (inputId: PropertiesNumericInputId) => {
    options.draft.finish(inputId);
    options.runtime.replace({
      scopeIdentity: options.readScopeIdentity(),
      focusedTransform: null,
    });
  };
  const dispatch = options.port.dispatchPanel;

  const focusNumericInput = (inputId: PropertiesNumericInputId) => {
    syncSelection();
    const { context, descriptor } = readScope();
    const transform = context.displayedTransform;
    if (!descriptor || !transform || !isPropertiesNumericInputEditable(descriptor, inputId)) {
      return false;
    }
    const { property } = getPropertiesNumericInputDescriptor(inputId);
    options.runtime.replace({
      scopeIdentity: options.readScopeIdentity(),
      focusedTransform: clonePropertiesTransform(transform),
    });
    options.draft.begin(
      inputId,
      formatPropertiesNumericValue(
        property,
        readPropertiesNumericValue(transform, inputId)
      ),
      options.readScopeIdentity()
    );
    return true;
  };

  const changeNumericInput = (inputId: PropertiesNumericInputId, value: string) => {
    syncSelection();
    if (
      options.draft.read().focusedInputId !== inputId ||
      parsePropertiesNumericDraft(value).kind === "invalid"
    ) return null;
    options.draft.change(inputId, value);
    const { descriptor } = readScope();
    const focusedTransform = options.runtime.read().focusedTransform;
    if (!descriptor || !focusedTransform) return null;
    const patch = buildPropertiesTransformPatch(focusedTransform, inputId, value);
    if (!patch || !hasPropertiesTransformPatchChanged(focusedTransform, patch)) {
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
    const { descriptor } = readScope();
    const focusedTransform = options.runtime.read().focusedTransform;
    const draftState = options.draft.read();
    const rawValue = draftState.inputDrafts[inputId];
    if (
      draftState.focusedInputId !== inputId ||
      !descriptor || !focusedTransform || rawValue === undefined
    ) return null;
    const patch = buildPropertiesTransformPatch(focusedTransform, inputId, rawValue);
    if (!patch || !hasPropertiesTransformPatchChanged(focusedTransform, patch)) {
      options.port.cancel();
      clearSession(inputId);
      return { ok: true as const, committed: false };
    }
    if (!options.port.preview(descriptor.layerDocumentId, patch).ok) {
      return { ok: false as const, reason: "preview-failed" as const };
    }
    const committed = options.port.commit();
    if (!committed?.ok) {
      return { ok: false as const, reason: "commit-failed" as const };
    }
    clearSession(inputId);
    return { ok: true as const, committed: true };
  };

  const cancelNumericInput = (inputId: PropertiesNumericInputId) => {
    if (options.draft.read().focusedInputId !== inputId) return false;
    options.port.cancel();
    clearSession(inputId);
    return true;
  };

  return {
    read: () => ({
      ...options.port.read(),
      runtime: {
        ...options.draft.read(),
        focusedTransform: options.runtime.read().focusedTransform,
      },
    }),
    readSelectedKeyframe: options.port.readSelectedKeyframe,
    syncSelection,
    focusNumericInput,
    changeNumericInput,
    blurNumericInput: commitNumericInput,
    keyDownNumericInput: (inputId: PropertiesNumericInputId, key: string) => {
      if (key === "Enter") {
        commitNumericInput(inputId);
        return "blur" as const;
      }
      if (key === "Escape") {
        cancelNumericInput(inputId);
        return "blur" as const;
      }
      return null;
    },
    togglePropertyTrack: (property: AnimatableProperty, enabled: boolean) => {
      syncSelection();
      const { context, descriptor } = readScope();
      if (
        !descriptor || !context.displayedTransform || context.localFrame === null ||
        descriptor.capabilities.animation.status !== "editable" ||
        descriptor.capabilities.transformInputs[property].status !== "editable" ||
        descriptor.animation.enabledProperties[property] === enabled
      ) return null;
      const result = dispatch({
        kind: "set-animation",
        layerDocumentId: descriptor.layerDocumentId,
        animation: buildPropertiesAnimationWithTrack(
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
      if (!descriptor || !context.displayedTransform || !isPropertiesNumericInputEditable(descriptor, "scale.x")) {
        return null;
      }
      return dispatch({
        kind: "set-scale-linked",
        layerDocumentId: descriptor.layerDocumentId,
        scaleLinked: !context.displayedTransform.scaleLinked,
      });
    },
    savePositionKeyframe: () => {
      syncSelection();
      const { context, descriptor } = readScope();
      if (!descriptor || !context.displayedTransform || context.localFrame === null || descriptor.capabilities.animation.status !== "editable") {
        return null;
      }
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
      const descriptor = readyPropertiesDescriptor(options.port.read().descriptor);
      const keyframe = options.port.readSelectedKeyframe();
      if (!descriptor || !keyframe || keyframe.layerDocumentId !== descriptor.layerDocumentId) {
        return null;
      }
      return options.port.dispatchTimeline({
        kind: "remove-keyframe",
        layerDocumentId: keyframe.layerDocumentId,
        property: keyframe.property,
        localFrame: keyframe.localFrame,
      });
    },
    previewTransform: (patch: PreviewSceneTransformPatch) => {
      syncSelection();
      const descriptor = readyPropertiesDescriptor(options.port.read().descriptor);
      return descriptor ? options.port.preview(descriptor.layerDocumentId, patch) : null;
    },
    commitTransformPreview: options.port.commit,
    cancelTransformPreview: options.port.cancel,
    setAnimation: (animation: LayerAnimation) => {
      const descriptor = readyPropertiesDescriptor(options.port.read().descriptor);
      return descriptor ? dispatch({
        kind: "set-animation",
        layerDocumentId: descriptor.layerDocumentId,
        animation,
      }) : null;
    },
  };
}

export function useVisualPropertiesController(options: {
  port: LayerDocumentPropertiesCommandPort;
  draft: PropertiesNumericDraftController;
  scopeIdentity: string;
}) {
  const [runtime, setRuntime] = useState<VisualPropertiesRuntimeState>({
    scopeIdentity: options.scopeIdentity,
    focusedTransform: null,
  });
  const controller = useMemo(
    () => createVisualPropertiesController({
      port: options.port,
      draft: options.draft,
      runtime: {
        read: () => runtime,
        replace: setRuntime,
      },
      readScopeIdentity: () => options.scopeIdentity,
    }),
    [options.draft, options.port, options.scopeIdentity, runtime]
  );
  useEffect(() => {
    controller.syncSelection();
  }, [controller, options.scopeIdentity]);
  return controller;
}
