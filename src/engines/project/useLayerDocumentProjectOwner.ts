import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createLayerDocumentProjectOwnerState,
  reduceLayerDocumentProjectOwner,
} from "@/engines/project/actions/layerDocumentProjectOwnerReducer";
import type {
  CreateLayerDocumentProjectOwnerOptions,
  LayerDocumentProjectOwnerAction,
  LayerDocumentProjectOwnerPort,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import {
  createLayerDocumentProjectOwnerLivePort,
} from "@/engines/project/helpers/layerDocumentProjectOwnerLivePortHelpers";

/**
 * Final-cutover owner wrapper. The Editor Root instantiates exactly one
 * caller-owned hook instance, which owns exactly one
 * canonical LayerDocument Project state; there is no module singleton.
 */
export function useLayerDocumentProjectOwner(
  options: CreateLayerDocumentProjectOwnerOptions
): LayerDocumentProjectOwnerPort {
  const [state, setState] = useState(() => {
    const initialized = createLayerDocumentProjectOwnerState(options);
    if (!initialized.ok) {
      throw new Error(initialized.error.message);
    }
    return initialized.state;
  });
  const stateRef = useRef(state);
  const transition = useCallback(
    (action: LayerDocumentProjectOwnerAction) => {
      const result = reduceLayerDocumentProjectOwner(
        stateRef.current,
        action
      );
      if (result.ok && result.changed) {
        stateRef.current = result.state;
        setState(result.state);
      }
      return result;
    },
    []
  );

  /*
   * The factory captures the ref without reading it during render; the
   * public getter reads it only when a consumer requests current state.
   */
  const port = useMemo(
    () =>
      createLayerDocumentProjectOwnerLivePort(
        stateRef,
        transition
      ),
    // Public port identity intentionally follows committed owner state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, transition]
  );
  return port;
}
