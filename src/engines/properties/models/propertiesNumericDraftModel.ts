import type {
  PropertiesDraftInputId,
} from "@/engines/properties/models/propertiesEngineModel";

export interface PropertiesNumericDraftState {
  readonly scopeIdentity: string;
  readonly focusedInputId: PropertiesDraftInputId | null;
  readonly inputDrafts: Partial<Record<PropertiesDraftInputId, string>>;
}

export interface PropertiesNumericDraftRuntimePort {
  readonly read: () => PropertiesNumericDraftState;
  readonly replace: (state: PropertiesNumericDraftState) => void;
}

export interface PropertiesNumericDraftController {
  readonly read: () => PropertiesNumericDraftState;
  readonly syncScope: (scopeIdentity: string) => boolean;
  readonly begin: (
    inputId: PropertiesDraftInputId,
    value: string,
    scopeIdentity: string
  ) => void;
  readonly change: (
    inputId: PropertiesDraftInputId,
    value: string
  ) => boolean;
  readonly finish: (inputId: PropertiesDraftInputId) => boolean;
  readonly cancel: (inputId: PropertiesDraftInputId) => boolean;
  readonly reset: (scopeIdentity?: string) => void;
}
