import {
  buildPropertiesCapabilities,
  buildPropertiesInfo,
  buildPropertiesSourceDetail,
  buildPropertiesSourceHeader,
} from "@/engines/visual/helpers/propertiesDescriptorViewModelHelpers";
import {
  buildModifierPropertiesLibraryViewModel,
  buildModifierPropertiesViewModels,
} from "@/engines/visual/helpers/modifierPropertiesViewModelHelpers";
import {
  readyPropertiesDescriptor,
  resolvePropertiesSelectionKind,
} from "@/engines/visual/helpers/propertiesSelectionHelpers";
import {
  buildVisualPropertiesProjection,
} from "@/engines/visual/helpers/visualPropertiesViewModelHelpers";
import type {
  LayerDocumentPropertiesReadContext,
} from "@/engines/visual/models/propertiesControllerModel";
import type {
  PropertiesNumericDraftState,
} from "@/engines/visual/models/propertiesNumericDraftModel";
import type {
  PropertiesCommand,
  PropertiesDraftInputId,
  PropertiesEngineViewProps,
  PropertiesModifierInputId,
  PropertiesNumericInputId,
  PropertiesReadModel,
} from "@/engines/visual/models/propertiesEngineModel";
import type { AnimatableProperty, ModifierType } from "@/models";

export interface PropertiesControllerSet {
  readonly read: () => LayerDocumentPropertiesReadContext & {
    readonly runtime: PropertiesNumericDraftState & {
      readonly focusedTransform: import("@/models").LayerTransform | null;
    };
  };
  readonly readSelectedKeyframe: () => {
    readonly layerDocumentId: string;
    readonly property: AnimatableProperty;
    readonly localFrame: number;
    readonly globalFrame: number;
  } | null;
  readonly togglePropertyTrack: PropertiesCommand["togglePropertyTrack"];
  readonly focusNumericInput: PropertiesCommand["focusNumericInput"];
  readonly changeNumericInput: PropertiesCommand["changeNumericInput"];
  readonly blurNumericInput: PropertiesCommand["blurNumericInput"];
  readonly keyDownNumericInput: PropertiesCommand["keyDownNumericInput"];
  readonly toggleScaleLink: PropertiesCommand["toggleScaleLink"];
  readonly savePositionKeyframe: PropertiesCommand["savePositionKeyframe"];
  readonly deleteSelectedKeyframe: PropertiesCommand["deleteSelectedKeyframe"];
  readonly toggleModifier: (type: ModifierType) => unknown;
  readonly focusModifierInput: (inputId: PropertiesModifierInputId) => unknown;
  readonly changeModifierInput: (inputId: PropertiesModifierInputId, value: string) => unknown;
  readonly blurModifierInput: (inputId: PropertiesModifierInputId) => unknown;
  readonly keyDownModifierInput: PropertiesCommand["keyDownModifierInput"];
  readonly toggleAccelerationProperty?: PropertiesCommand["toggleAccelerationProperty"];
  readonly setAccelerationCurve?: PropertiesCommand["setAccelerationCurve"];
  readonly setMouthBasicAudioLayer?: PropertiesCommand["setMouthBasicAudioLayer"];
  readonly toggleMouthBasicInverted?: PropertiesCommand["toggleMouthBasicInverted"];
  readonly setMouthBasicRepetitionsPerSecond?: PropertiesCommand["setMouthBasicRepetitionsPerSecond"];
  readonly focusMouthBasicRepetitions?: PropertiesCommand["focusMouthBasicRepetitions"];
  readonly changeMouthBasicRepetitions?: PropertiesCommand["changeMouthBasicRepetitions"];
  readonly blurMouthBasicRepetitions?: PropertiesCommand["blurMouthBasicRepetitions"];
  readonly keyDownMouthBasicRepetitions?: PropertiesCommand["keyDownMouthBasicRepetitions"];
}

const noCommand = () => undefined;

export function buildLayerDocumentPropertiesViewProps(options: {
  controller: PropertiesControllerSet;
  formatTime?: (frame: number, frameRate: number) => string;
  frameRate?: number;
  mouthAudioOptions?: readonly { id: string; label: string }[];
  setMouthBasicAudioLayer?: (audioLayerDocumentId: string) => void;
  toggleMouthBasicInverted?: () => void;
  setMouthBasicRepetitionsPerSecond?: (value: number) => void;
  scopeIdentity?: string;
}): PropertiesEngineViewProps {
  const read = options.controller.read();
  const descriptor = readyPropertiesDescriptor(read.descriptor);
  const selectionKind = resolvePropertiesSelectionKind(descriptor);
  const selected = descriptor ? options.controller.readSelectedKeyframe() : null;
  const selectedKeyframe = selected && descriptor
    ? { frame: selected.localFrame, property: selected.property }
    : null;
  const frameRate = options.frameRate ?? 30;
  const formatTime = options.formatTime ?? (
    (frame: number, rate: number) => `${(frame / rate).toFixed(2)}s`
  );
  const activeDrafts = (
    options.scopeIdentity === undefined ||
    read.runtime.scopeIdentity === options.scopeIdentity
  )
    ? read.runtime.inputDrafts
    : {};
  const visual = buildVisualPropertiesProjection({
    descriptor,
    transform: read.displayedTransform,
    localFrame: read.localFrame,
    selectedKeyframe,
    drafts: activeDrafts as Partial<Record<PropertiesNumericInputId, string>>,
    frameRate,
    formatTime,
  });
  const readModel: PropertiesReadModel = {
    hasSelectedComposition: Boolean(descriptor),
    info: descriptor ? buildPropertiesInfo(descriptor) : null,
    targetName: descriptor && !descriptor.isProjectRoot
      ? descriptor.displayName
      : null,
    targetEntityKind: descriptor
      ? descriptor.type === "group" ? "composition" : "layer"
      : null,
    sourceHeader: descriptor ? buildPropertiesSourceHeader(descriptor) : null,
    sourceDetail: descriptor ? buildPropertiesSourceDetail(descriptor) : null,
    capabilities: descriptor ? buildPropertiesCapabilities(descriptor) : [],
    transformSectionVisible: Boolean(
      selectionKind === "visual" && read.displayedTransform
    ),
    currentTimeText: formatTime(read.globalFrame, frameRate),
    currentValues: visual.values,
    rows: visual.rows,
    transformOrigin: visual.transformOrigin,
    keyframe: visual.keyframe,
    modifiers: buildModifierPropertiesViewModels({
      descriptor,
      drafts: activeDrafts as Partial<Record<PropertiesDraftInputId, string>>,
      mouthAudioOptions: options.mouthAudioOptions,
    }),
    modifierLibrary: buildModifierPropertiesLibraryViewModel(descriptor),
    importError: null,
    importNotice: null,
  };
  return {
    readModel,
    commands: {
      togglePropertyTrack: options.controller.togglePropertyTrack,
      focusNumericInput: options.controller.focusNumericInput,
      changeNumericInput: options.controller.changeNumericInput,
      blurNumericInput: options.controller.blurNumericInput,
      keyDownNumericInput: options.controller.keyDownNumericInput,
      toggleScaleLink: options.controller.toggleScaleLink,
      savePositionKeyframe: options.controller.savePositionKeyframe,
      deleteSelectedKeyframe: options.controller.deleteSelectedKeyframe,
      toggleModifier: options.controller.toggleModifier,
      setMouthBasicAudioLayer: options.setMouthBasicAudioLayer ??
        options.controller.setMouthBasicAudioLayer ?? noCommand,
      toggleMouthBasicInverted: options.toggleMouthBasicInverted ??
        options.controller.toggleMouthBasicInverted ?? noCommand,
      setMouthBasicRepetitionsPerSecond: options.setMouthBasicRepetitionsPerSecond ??
        options.controller.setMouthBasicRepetitionsPerSecond ?? noCommand,
      focusMouthBasicRepetitions:
        options.controller.focusMouthBasicRepetitions ?? noCommand,
      changeMouthBasicRepetitions:
        options.controller.changeMouthBasicRepetitions ?? noCommand,
      blurMouthBasicRepetitions:
        options.controller.blurMouthBasicRepetitions ?? noCommand,
      keyDownMouthBasicRepetitions:
        options.controller.keyDownMouthBasicRepetitions ?? (() => null),
      toggleAccelerationProperty:
        options.controller.toggleAccelerationProperty ?? noCommand,
      setAccelerationCurve: options.controller.setAccelerationCurve ?? noCommand,
      focusModifierInput: options.controller.focusModifierInput,
      changeModifierInput: options.controller.changeModifierInput,
      blurModifierInput: options.controller.blurModifierInput,
      keyDownModifierInput: options.controller.keyDownModifierInput,
    },
  };
}
