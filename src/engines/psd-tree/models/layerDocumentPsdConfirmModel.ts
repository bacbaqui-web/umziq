import type {
  LayerDocumentProjectOwnerTransitionResult,
} from "@/engines/project";
import type {
  LayerDocumentRuntimeBatchRegistrationResult,
} from "@/render";

export type LayerDocumentPreparedPsdConfirmResult =
  | {
      readonly ok: true;
      readonly status:
        | "confirmed"
        | "runtime-registration-retried";
      readonly transition: Extract<
        LayerDocumentProjectOwnerTransitionResult,
        { ok: true }
      > | null;
      readonly registration: Extract<
        LayerDocumentRuntimeBatchRegistrationResult,
        { ok: true }
      >;
    }
  | {
      readonly ok: false;
      readonly status:
        | "rejected"
        | "runtime-registration-pending";
      readonly stage:
        | "lifecycle"
        | "preflight"
        | "preparation"
        | "owner"
        | "runtime-registration";
      readonly message: string;
      readonly recovery:
        | "none"
        | "retry-runtime-registration";
      readonly transition: Extract<
        LayerDocumentProjectOwnerTransitionResult,
        { ok: true }
      > | null;
      readonly registration:
        LayerDocumentRuntimeBatchRegistrationResult | null;
    };
