import type { LayerModifier, LayerTransform } from "@/models";
import { createModifierPropertiesController } from "@/engines/properties/controllers/modifierPropertiesController";
import { createPropertiesNumericDraftController } from "@/engines/properties/controllers/propertiesNumericDraftController";
import { createVisualPropertiesController } from "@/engines/properties/controllers/visualPropertiesController";
import { buildPropertiesDraftScopeIdentity } from "@/engines/properties/helpers/propertiesSelectionHelpers";
import type {
  LayerDocumentPropertiesCommandPort,
  LayerDocumentPropertiesReadContext,
} from "@/engines/properties/models/propertiesControllerModel";
import type { PropertiesDraftInputId } from "@/engines/properties/models/propertiesEngineModel";

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

function scopeState(port: LayerDocumentPropertiesCommandPort) {
  const context = port.read();
  const descriptor = context.descriptor.status === "ready"
    ? context.descriptor.descriptor
    : null;
  return { context, descriptor };
}

function legacyScopeIdentity(state: LayerDocumentPropertiesRuntimeState) {
  return [
    state.selectedLayerDocumentId ?? "none",
    state.selectedLayerRevision ?? "none",
    state.globalFrame,
    state.localFrame ?? "none",
    "none",
  ].join(":");
}

function replaceLegacyRuntime(
  port: LayerDocumentPropertiesCommandPort,
  runtime: LayerDocumentPropertiesRuntimePort,
  update: {
    focusedInputId: PropertiesDraftInputId | null;
    focusedTransform: LayerTransform | null;
    inputDrafts: Partial<Record<PropertiesDraftInputId, string>>;
  }
) {
  const { context, descriptor } = scopeState(port);
  runtime.replace({
    selectedLayerDocumentId: descriptor?.layerDocumentId ?? null,
    selectedLayerRevision: descriptor?.revision ?? null,
    globalFrame: context.globalFrame,
    localFrame: context.localFrame,
    ...update,
  });
}

/** Compatibility composer for the pre-Sprint-F public controller contract. */
export function createLayerDocumentPropertiesController(options: {
  port: LayerDocumentPropertiesCommandPort;
  runtime: LayerDocumentPropertiesRuntimePort;
}) {
  const draft = createPropertiesNumericDraftController({
    read: () => {
      const state = options.runtime.read();
      return {
        scopeIdentity: legacyScopeIdentity(state),
        focusedInputId: state.focusedInputId,
        inputDrafts: state.inputDrafts,
      };
    },
    replace: (state) => replaceLegacyRuntime(options.port, options.runtime, {
      focusedInputId: state.focusedInputId,
      focusedTransform: options.runtime.read().focusedTransform,
      inputDrafts: state.inputDrafts,
    }),
  });
  const visual = createVisualPropertiesController({
    port: options.port,
    draft,
    runtime: {
      read: () => ({
        scopeIdentity: legacyScopeIdentity(options.runtime.read()),
        focusedTransform: options.runtime.read().focusedTransform,
      }),
      replace: (state) => replaceLegacyRuntime(options.port, options.runtime, {
        focusedInputId: options.runtime.read().focusedInputId,
        focusedTransform: state.focusedTransform,
        inputDrafts: options.runtime.read().inputDrafts,
      }),
    },
    readScopeIdentity: () => buildPropertiesDraftScopeIdentity(options.port.read()),
  });
  const modifier = createModifierPropertiesController({
    dispatchPanel: options.port.dispatchPanel,
    readDescriptor: () => {
      const result = options.port.read().descriptor;
      return result.status === "ready" ? result.descriptor : null;
    },
    draft,
    readScopeIdentity: () => buildPropertiesDraftScopeIdentity(options.port.read()),
  });
  return {
    ...visual,
    toggleModifier: modifier.toggleModifier,
    focusModifierInput: modifier.focusModifierInput,
    changeModifierInput: modifier.changeModifierInput,
    blurModifierInput: modifier.blurModifierInput,
    keyDownModifierInput: modifier.keyDownModifierInput,
    toggleAccelerationProperty: modifier.toggleAccelerationProperty,
    setAccelerationCurve: modifier.setAccelerationCurve,
    toggleMouthBasicInverted: modifier.toggleMouthBasicInverted,
    setMouthBasicRepetitionsPerSecond: modifier.setMouthBasicRepetitionsPerSecond,
    setModifiers: (modifiers: LayerModifier[]) => modifier.setModifiers(modifiers),
    dispatch: options.port.dispatchPanel,
  };
}

export type {
  LayerDocumentPropertiesCommandPort,
  LayerDocumentPropertiesReadContext,
};
