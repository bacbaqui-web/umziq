import type {
  LayerDocumentNexusTransitionResult,
  NexusHistoryPort,
  NexusProjectReadPort,
  NexusReplacePort,
  NexusSelectionPort,
  NexusTransactionPort,
} from "@/engines/project/models/layerDocumentNexusModel";

/**
 * Editor-owned Project boundary.
 *
 * Commands return their Runtime effect in the successful transition result;
 * consumers apply that effect through injected Runtime ports. Panel Runtime
 * is deliberately not part of this boundary.
 */
export type EditorNexusPort = NexusProjectReadPort &
  NexusTransactionPort &
  NexusReplacePort &
  NexusHistoryPort &
  NexusSelectionPort;

export type EditorNexusCommandResult<
  TPreparation = unknown,
> =
  | {
      readonly ok: true;
      readonly transition: Extract<
        LayerDocumentNexusTransitionResult,
        { ok: true }
      >;
    }
  | {
      readonly ok: false;
      readonly stage: "preparation" | "nexus";
      readonly message: string;
      readonly preparation?: TPreparation;
      readonly transition?: Extract<
        LayerDocumentNexusTransitionResult,
        { ok: false }
      >;
    };
