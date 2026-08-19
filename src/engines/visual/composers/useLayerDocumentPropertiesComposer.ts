import { useMemo } from "react";
import {
  createModifierPropertiesController,
  type ModifierPropertiesControllerPort,
} from "@/engines/visual/controllers/modifierPropertiesController";
import {
  usePropertiesNumericDraftController,
} from "@/engines/visual/controllers/propertiesNumericDraftController";
import {
  useVisualPropertiesController,
} from "@/engines/visual/controllers/visualPropertiesController";
import {
  buildLayerDocumentPropertiesViewProps,
  type PropertiesControllerSet,
} from "@/engines/visual/composers/propertiesViewPropsComposer";
import {
  buildPropertiesDraftScopeIdentity,
  readyPropertiesDescriptor,
} from "@/engines/visual/helpers/propertiesSelectionHelpers";
import type {
  LayerDocumentPropertiesCommandPort,
} from "@/engines/visual/models/propertiesControllerModel";

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
  const modifier = useMemo(() => createModifierPropertiesController({
    ...options.mouthBasic,
    dispatchPanel: options.port.dispatchPanel,
    readDescriptor: () => readyPropertiesDescriptor(options.port.read().descriptor),
    draft,
    readScopeIdentity: () => scopeIdentity,
  }), [draft, options.mouthBasic, options.port, scopeIdentity]);
  const controller: PropertiesControllerSet = {
    ...visual,
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
    focusMouthBasicRepetitions: modifier.focusMouthBasicRepetitions,
    changeMouthBasicRepetitions: modifier.changeMouthBasicRepetitions,
    blurMouthBasicRepetitions: modifier.blurMouthBasicRepetitions,
    keyDownMouthBasicRepetitions: modifier.keyDownMouthBasicRepetitions,
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
