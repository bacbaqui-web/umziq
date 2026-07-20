import { useCallback } from "react";
import type { Position, Scale } from "@/models";
import type { PropertiesDraftInputId } from "@/engines/properties/models/propertiesEngineModel";
import type {
  PropertiesDraftControllerPort,
  PropertiesDraftStatePort,
} from "@/engines/properties/models/propertiesInternalModel";

type Options = {
  scope: string;
  state: PropertiesDraftStatePort;
};

export function usePropertiesDraftController({ scope, state }: Options): PropertiesDraftControllerPort {
  const isCurrentScope = state.numericDraftScope === scope;
  const focusedInputId = isCurrentScope
    ? state.focusedNumericInputId as PropertiesDraftInputId | null
    : null;

  const getNumericDraft = useCallback((inputId: PropertiesDraftInputId) => {
    if (!isCurrentScope) return undefined;
    return state.numericDrafts[inputId];
  }, [isCurrentScope, state.numericDrafts]);

  const hasNumericDraft = useCallback((inputId: PropertiesDraftInputId) => (
    isCurrentScope && Object.prototype.hasOwnProperty.call(state.numericDrafts, inputId)
  ), [isCurrentScope, state.numericDrafts]);

  const focusNumericDraft = useCallback((inputId: PropertiesDraftInputId) => {
    if (state.numericDraftScope !== scope) {
      state.setNumericDrafts({});
      state.setNumericDraftScope(scope);
    }
    state.setFocusedNumericInputId(inputId);
  }, [scope, state]);

  const setNumericDraft = useCallback((inputId: PropertiesDraftInputId, value: string) => {
    state.setNumericDrafts((current) => ({ ...current, [inputId]: value }));
  }, [state]);

  const clearNumericDraft = useCallback((inputId: PropertiesDraftInputId) => {
    state.setNumericDrafts((current) => {
      if (!Object.prototype.hasOwnProperty.call(current, inputId)) return current;
      const next = { ...current };
      delete next[inputId];
      return next;
    });
  }, [state]);

  const clearNumericFocus = useCallback(() => {
    state.setFocusedNumericInputId(null);
  }, [state]);

  const setPositionDraft = useCallback((value: Position) => {
    state.setPositionDraft(value);
  }, [state]);
  const setScaleDraft = useCallback((value: Scale) => {
    state.setScaleDraft(value);
  }, [state]);
  const setRotationDraft = useCallback((value: number) => {
    state.setRotationDraft(value);
  }, [state]);
  const setOpacityDraft = useCallback((value: number) => {
    state.setOpacityDraft(value);
  }, [state]);

  return {
    scope,
    focusedInputId,
    getNumericDraft,
    hasNumericDraft,
    focusNumericDraft,
    setNumericDraft,
    clearNumericDraft,
    clearNumericFocus,
    setPositionDraft,
    setScaleDraft,
    setRotationDraft,
    setOpacityDraft,
  };
}
