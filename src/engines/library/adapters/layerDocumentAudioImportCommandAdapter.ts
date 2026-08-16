import type { LayerDocumentProject } from "@/models";
import type {
  LayerDocumentAudioRuntimePort,
  LayerDocumentAudioRuntimeRegistrationResult,
  LayerDocumentSourceRuntimeResolutionPort,
  LayerDocumentSourceTransactionResult,
  PreparedLayerDocumentAudioImport,
} from "@/engines/project";

export type LayerDocumentAudioImportConfirmResult =
  | {
      readonly ok: true;
      readonly status: "confirmed" | "runtime-registration-retried";
      readonly registration: LayerDocumentAudioRuntimeRegistrationResult;
    }
  | {
      readonly ok: false;
      readonly status: "rejected" | "runtime-registration-pending";
      readonly stage: "lifecycle" | "preflight" | "preparation" | "owner" | "runtime-registration";
      readonly message: string;
      readonly recovery: "none" | "retry-runtime-registration";
    };

export function confirmLayerDocumentAudioPreparedSource(options: {
  prepared: PreparedLayerDocumentAudioImport;
  readProject: () => LayerDocumentProject;
  prepare: (
    project: LayerDocumentProject,
    command: PreparedLayerDocumentAudioImport["command"]
  ) => LayerDocumentSourceTransactionResult;
  commit: (preparation: LayerDocumentSourceTransactionResult) =>
    { readonly ok: true } |
    { readonly ok: false; readonly stage: "preparation" | "owner"; readonly message: string };
  runtime: LayerDocumentAudioRuntimePort;
  sourceResolution: LayerDocumentSourceRuntimeResolutionPort;
}): LayerDocumentAudioImportConfirmResult {
  const lifecycle = options.prepared.runtime;
  const claim = options.prepared.runtime.claimForConfirm();
  if (!claim.ok) {
    return {
      ok: false, status: "rejected", stage: "lifecycle",
      message: `Prepared Audio runtime is ${claim.state}`, recovery: "none",
    };
  }
  const preflight = options.runtime.preflight(claim.resources);
  if (!preflight.ok) {
    if (claim.mode === "commit-owner") lifecycle.failBeforeOwner();
    return {
      ok: false,
      status: claim.mode === "commit-owner" ? "rejected" : "runtime-registration-pending",
      stage: "preflight", message: preflight.message,
      recovery: claim.mode === "commit-owner" ? "none" : "retry-runtime-registration",
    };
  }
  if (claim.mode === "commit-owner") {
    const committed = options.commit(options.prepare(
      options.readProject(), options.prepared.command
    ));
    if (!committed.ok) {
      lifecycle.failBeforeOwner();
      return {
        ok: false, status: "rejected", stage: committed.stage,
        message: committed.message, recovery: "none",
      };
    }
    lifecycle.markOwnerCommitted();
  }
  const registration = options.runtime.register(claim.resources);
  if (!registration.ok) {
    lifecycle.markRegistrationFailed();
    return {
      ok: false, status: "runtime-registration-pending",
      stage: "runtime-registration", message: registration.message,
      recovery: "retry-runtime-registration",
    };
  }
  lifecycle.markTransferred();
  options.sourceResolution.setAvailable({
    sourceId: options.prepared.sourceId,
    file: options.prepared.file,
  });
  return {
    ok: true,
    status: claim.mode === "commit-owner"
      ? "confirmed"
      : "runtime-registration-retried",
    registration,
  };
}
