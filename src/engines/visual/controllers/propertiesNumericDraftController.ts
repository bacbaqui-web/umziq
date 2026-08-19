import { useEffect, useMemo, useState } from "react";
import type {
  PropertiesDraftInputId,
} from "@/engines/visual/models/propertiesEngineModel";
import type {
  PropertiesNumericDraftController,
  PropertiesNumericDraftRuntimePort,
  PropertiesNumericDraftState,
} from "@/engines/visual/models/propertiesNumericDraftModel";

function emptyDraftState(scopeIdentity: string): PropertiesNumericDraftState {
  return {
    scopeIdentity,
    focusedInputId: null,
    inputDrafts: {},
  };
}

export function createPropertiesNumericDraftController(
  runtime: PropertiesNumericDraftRuntimePort
): PropertiesNumericDraftController {
  const syncScope = (scopeIdentity: string) => {
    if (runtime.read().scopeIdentity === scopeIdentity) return false;
    runtime.replace(emptyDraftState(scopeIdentity));
    return true;
  };

  const finish = (inputId: PropertiesDraftInputId) => {
    if (runtime.read().focusedInputId !== inputId) return false;
    runtime.replace(emptyDraftState(runtime.read().scopeIdentity));
    return true;
  };

  return {
    read: runtime.read,
    syncScope,
    begin: (inputId, value, scopeIdentity) => {
      syncScope(scopeIdentity);
      runtime.replace({
        scopeIdentity,
        focusedInputId: inputId,
        inputDrafts: { [inputId]: value },
      });
    },
    change: (inputId, value) => {
      const state = runtime.read();
      if (state.focusedInputId !== inputId) return false;
      runtime.replace({
        ...state,
        inputDrafts: { ...state.inputDrafts, [inputId]: value },
      });
      return true;
    },
    finish,
    cancel: finish,
    reset: (scopeIdentity = runtime.read().scopeIdentity) => {
      runtime.replace(emptyDraftState(scopeIdentity));
    },
  };
}

export function usePropertiesNumericDraftController(scopeIdentity: string) {
  const [state, setState] = useState<PropertiesNumericDraftState>(() =>
    emptyDraftState(scopeIdentity)
  );
  const controller = useMemo(
    () => createPropertiesNumericDraftController({
      read: () => state,
      replace: setState,
    }),
    [state]
  );

  useEffect(() => {
    controller.syncScope(scopeIdentity);
  }, [controller, scopeIdentity]);

  return controller;
}
