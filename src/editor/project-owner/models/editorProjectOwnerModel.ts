import type {
  LayerDocumentProjectOwnerPort,
  LayerDocumentProjectOwnerTransitionResult,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";

/**
 * Editor-owned Project boundary.
 *
 * Commands return their Runtime effect in the successful transition result;
 * consumers apply that effect through injected Runtime ports. Panel Runtime
 * is deliberately not part of this boundary.
 */
export type EditorProjectOwnerPort =
  LayerDocumentProjectOwnerPort;

export type EditorOwnerCommandResult<
  TPreparation = unknown,
> =
  | {
      readonly ok: true;
      readonly transition: Extract<
        LayerDocumentProjectOwnerTransitionResult,
        { ok: true }
      >;
    }
  | {
      readonly ok: false;
      readonly stage: "preparation" | "owner";
      readonly message: string;
      readonly preparation?: TPreparation;
      readonly transition?: Extract<
        LayerDocumentProjectOwnerTransitionResult,
        { ok: false }
      >;
    };
