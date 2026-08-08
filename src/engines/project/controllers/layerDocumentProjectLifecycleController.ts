import {
  saveLayerDocumentProjectToZiq,
} from "@/engines/project/adapters/layerDocumentProjectPersistenceCodec";
import type {
  CreateLayerDocumentProjectLifecycleOptions,
  LayerDocumentProjectLifecycleController,
  LayerDocumentProjectLifecycleResult,
  LayerDocumentProjectLifecycleState,
  LayerDocumentProjectOperationToken,
  MarkLayerDocumentProjectSavedOptions,
  ReplaceLayerDocumentProjectOptions,
} from "@/engines/project/models/layerDocumentProjectLifecycleModel";
import type {
  LayerDocumentProject,
} from "@/models";

function success<T>(
  value: T
): LayerDocumentProjectLifecycleResult<T> {
  return { ok: true, value };
}

function canonicalProjectDigest(
  project: LayerDocumentProject
): LayerDocumentProjectLifecycleResult<string> {
  const encoded =
    saveLayerDocumentProjectToZiq(project);
  if (!encoded.ok) {
    return {
      ok: false,
      error: {
        code: "invalid-project",
        message: encoded.error.message,
      },
    };
  }
  let hash1 = 0x243f6a88;
  let hash2 = 0x85a308d3;
  let hash3 = 0x13198a2e;
  let hash4 = 0x03707344;
  encoded.value.forEach((byte) => {
    hash1 = Math.imul(hash1 ^ byte, 0x01000193);
    hash2 = Math.imul(hash2 ^ byte, 0x5bd1e995);
    hash3 = Math.imul(hash3 ^ byte, 0x27d4eb2d);
    hash4 = Math.imul(hash4 ^ byte, 0x165667b1);
  });
  const part = (value: number) =>
    (value >>> 0).toString(16).padStart(8, "0");
  return success(
    `canonical-v1:${encoded.value.byteLength}:` +
      `${part(hash1)}${part(hash2)}` +
      `${part(hash3)}${part(hash4)}`
  );
}

function tokensMatch(
  active: LayerDocumentProjectOperationToken | null,
  candidate:
    LayerDocumentProjectOperationToken | undefined
) {
  return (
    !candidate ||
    (
      active?.sequence === candidate.sequence &&
      active.operation === candidate.operation
    )
  );
}

export function createLayerDocumentProjectLifecycleController(
  options: CreateLayerDocumentProjectLifecycleOptions
): LayerDocumentProjectLifecycleController {
  let sequence = 0;
  let document = options.document ?? "untitled";
  let operation:
    LayerDocumentProjectLifecycleState["operation"] =
      "idle";
  let operationToken:
    LayerDocumentProjectOperationToken | null = null;
  let observedProject = options.owner.state.currentProject;
  const initialDigest =
    canonicalProjectDigest(observedProject);
  if (!initialDigest.ok) {
    throw new Error(initialDigest.error.message);
  }
  let currentProjectDigest = initialDigest.value;
  let savepointDigest =
    options.initiallyClean === false
      ? null
      : currentProjectDigest;

  const refreshCurrentDigest = () => {
    const project = options.owner.state.currentProject;
    if (project === observedProject) return;
    const digest = canonicalProjectDigest(project);
    if (!digest.ok) {
      throw new Error(
        `Owner Project became invalid: ${digest.error.message}`
      );
    }
    observedProject = project;
    currentProjectDigest = digest.value;
  };
  const read = (): LayerDocumentProjectLifecycleState => {
    refreshCurrentDigest();
    return {
      document,
      dirty:
        savepointDigest !== null &&
        savepointDigest === currentProjectDigest
          ? "clean"
          : "dirty",
      operation,
      operationToken,
      savepointDigest,
      currentProjectDigest,
    };
  };
  const endOperation = (
    token?: LayerDocumentProjectOperationToken
  ) => {
    if (!token) return;
    operation = "idle";
    operationToken = null;
  };
  const staleOperation = <T>() =>
    ({
      ok: false,
      error: {
        code: "stale-operation",
        message:
          "Project lifecycle ignored a stale operation result",
      },
    }) as LayerDocumentProjectLifecycleResult<T>;

  return {
    read,
    beginOperation: (nextOperation) => {
      sequence += 1;
      operationToken = {
        sequence,
        operation: nextOperation,
      };
      operation = nextOperation;
      return operationToken;
    },
    finishOperation: (token) => {
      if (!tokensMatch(operationToken, token)) {
        return false;
      }
      operation = "idle";
      operationToken = null;
      return true;
    },
    replaceProject: (
      replaceOptions: ReplaceLayerDocumentProjectOptions
    ) => {
      if (
        !tokensMatch(
          operationToken,
          replaceOptions.token
        )
      ) {
        return staleOperation();
      }
      const candidateDigest =
        canonicalProjectDigest(replaceOptions.project);
      if (!candidateDigest.ok) {
        endOperation(replaceOptions.token);
        return candidateDigest;
      }
      const transition = options.owner.transition({
        kind: "replace-project",
        project: replaceOptions.project,
      });
      if (!transition.ok) {
        endOperation(replaceOptions.token);
        return {
          ok: false,
          error: {
            code: "owner-rejected",
            message: transition.error.message,
          },
        };
      }
      if (transition.effect.stopPlayback) {
        options.runtime.stopPlayback();
      }
      if (transition.effect.clearDraft) {
        options.runtime.clearDraft();
      }
      if (
        transition.effect.runtimeCachePolicy ===
        "invalidate-all"
      ) {
        options.runtime.invalidateSourceRuntime({
          kind: "all",
        });
      }
      options.runtime.resetSourceResolution();
      if (transition.effect.resetLocalUi) {
        options.runtime.resetLocalUi();
      }
      if (transition.effect.recomputeRender) {
        options.runtime.recomputeRender?.();
      }
      options.runtime.publishOwnerEffect?.(
        transition.effect
      );
      observedProject =
        transition.state.currentProject;
      currentProjectDigest =
        candidateDigest.value;
      savepointDigest = candidateDigest.value;
      document = replaceOptions.document;
      operation = "idle";
      operationToken = null;
      return success(transition);
    },
    markSaved: (
      saved:
        MarkLayerDocumentProjectSavedOptions
    ) => {
      if (
        !tokensMatch(operationToken, saved.token)
      ) {
        return staleOperation();
      }
      const digest =
        canonicalProjectDigest(saved.savedSnapshot);
      if (!digest.ok) {
        endOperation(saved.token);
        return digest;
      }
      savepointDigest = digest.value;
      document = "file-backed";
      endOperation(saved.token);
      return success(read());
    },
  };
}
