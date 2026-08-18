import { useMemo } from "react";
import {
  createAudioPropertiesController,
} from "@/engines/properties/controllers/audioPropertiesController";
import {
  createModifierPropertiesController,
  type ModifierPropertiesControllerPort,
} from "@/engines/properties/controllers/modifierPropertiesController";
import {
  usePropertiesNumericDraftController,
} from "@/engines/properties/controllers/propertiesNumericDraftController";
import {
  useVisualPropertiesController,
} from "@/engines/properties/controllers/visualPropertiesController";
import {
  buildLayerDocumentPropertiesViewProps,
  type PropertiesControllerSet,
} from "@/engines/properties/composers/propertiesViewPropsComposer";
import {
  buildPropertiesDraftScopeIdentity,
  readyPropertiesDescriptor,
} from "@/engines/properties/helpers/propertiesSelectionHelpers";
import type {
  LayerDocumentPropertiesCommandPort,
} from "@/engines/properties/models/propertiesControllerModel";

export function useLayerDocumentPropertiesComposer(options: {
  port: LayerDocumentPropertiesCommandPort;
  formatTime?: (frame: number, frameRate: number) => string;
  frameRate?: number;
  resetRevision?: number;
  mouthBasic?: Pick<
    ModifierPropertiesControllerPort,
    "readProject" | "readDecodedAudio"
  >;
}) {
  const scopeIdentity = buildPropertiesDraftScopeIdentity(
    options.port.read(),
    options.resetRevision
  );
  const draft = usePropertiesNumericDraftController(scopeIdentity);
  const visual = useVisualPropertiesController({
    port: options.port,
    draft,
    scopeIdentity,
  });
  const audio = useMemo(() => createAudioPropertiesController({
    port: options.port,
    draft,
    readScopeIdentity: () => scopeIdentity,
  }), [draft, options.port, scopeIdentity]);
  const modifier = useMemo(() => createModifierPropertiesController({
    ...options.mouthBasic,
    dispatchPanel: options.port.dispatchPanel,
    readDescriptor: () => readyPropertiesDescriptor(options.port.read().descriptor),
    draft,
    readScopeIdentity: () => scopeIdentity,
  }), [draft, options.mouthBasic, options.port, scopeIdentity]);
  const controller: PropertiesControllerSet = {
    ...visual,
    ...audio,
    toggleModifier: modifier.toggleModifier,
    focusModifierInput: modifier.focusModifierInput,
    changeModifierInput: modifier.changeModifierInput,
    blurModifierInput: modifier.blurModifierInput,
    keyDownModifierInput: modifier.keyDownModifierInput,
    toggleAccelerationProperty: modifier.toggleAccelerationProperty,
    setAccelerationCurve: modifier.setAccelerationCurve,
    setMouthBasicAudioLayer: modifier.setMouthBasicAudioLayer,
    toggleMouthBasicInverted: modifier.toggleMouthBasicInverted,
    setMouthBasicRepetitionsPerSecond: modifier.setMouthBasicRepetitionsPerSecond,
  };
  return {
    controller,
    viewProps: buildLayerDocumentPropertiesViewProps({
      controller,
      formatTime: options.formatTime,
      frameRate: options.frameRate,
      mouthAudioOptions: modifier.readMouthAudioOptions(),
      scopeIdentity,
    }),
  };
}
