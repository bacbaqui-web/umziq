import {
  saveLayerDocumentProjectToZiq,
} from "@/engines/project/adapters/layerDocumentProjectPersistenceCodec";
import type {
  LayerDocumentProject,
} from "@/models";
import type {
  LayerDocumentProjectOperationToken,
} from "@/engines/project/models/layerDocumentProjectLifecycleModel";
import type {
  CreateLayerDocumentProjectSaveControllerOptions,
  LayerDocumentProjectSaveController,
  LayerDocumentProjectSaveResult,
} from "@/engines/project/models/layerDocumentProjectSaveModel";
import type {
  LayerDocumentProjectWriteTarget,
} from "@/engines/project/models/layerDocumentProjectBrowserWriteModel";

function cloneProject(
  project: LayerDocumentProject
): LayerDocumentProject {
  return JSON.parse(
    JSON.stringify(project)
  ) as LayerDocumentProject;
}

function suggestedFileName(
  project: LayerDocumentProject
) {
  const base = project.metadata.name
    .trim()
    .replace(/[<>:"/\\|?*]/g, "-")
    .split("")
    .map((character) =>
      character.charCodeAt(0) < 32
        ? "-"
        : character
    )
    .join("")
    .replace(/\.+$/g, "")
    .slice(0, 120) || "untitled";
  return base.toLowerCase().endsWith(".ziq")
    ? base
    : `${base}.ziq`;
}

function activeTokenMatches(
  options:
    CreateLayerDocumentProjectSaveControllerOptions,
  token: LayerDocumentProjectOperationToken
) {
  const active =
    options.lifecycle.read().operationToken;
  return (
    active?.sequence === token.sequence &&
    active.operation === token.operation
  );
}

export function createLayerDocumentProjectSaveController(
  options:
    CreateLayerDocumentProjectSaveControllerOptions
): LayerDocumentProjectSaveController {
  let currentTarget:
    LayerDocumentProjectWriteTarget | null = null;
  let writeQueue: Promise<void> =
    Promise.resolve();

  const save = async (
    forceChooseTarget: boolean
  ): Promise<LayerDocumentProjectSaveResult> => {
    const snapshot =
      cloneProject(options.readProject());
    const token =
      options.lifecycle.beginOperation("saving");
    const encoded =
      saveLayerDocumentProjectToZiq(snapshot);
    if (!encoded.ok) {
      options.lifecycle.finishOperation(token);
      return {
        ok: false,
        error: {
          code: "invalid-project",
          message: encoded.error.message,
        },
      };
    }
    let candidateTarget = currentTarget;
    if (forceChooseTarget || !candidateTarget) {
      const selected =
        await options.browser.chooseTarget(
          suggestedFileName(snapshot)
        );
      if (!selected.ok) {
        options.lifecycle.finishOperation(token);
        return selected;
      }
      candidateTarget = selected.value;
    }
    if (!activeTokenMatches(options, token)) {
      return {
        ok: false,
        error: {
          code: "stale-operation",
          message:
            "A newer Project operation superseded this save",
        },
      };
    }
    const writeAttempt = writeQueue.then(() =>
      options.browser.write({
        target: candidateTarget,
        bytes: encoded.value,
        shouldCommit: () =>
          activeTokenMatches(options, token),
      })
    );
    writeQueue = writeAttempt.then(
      () => undefined,
      () => undefined
    );
    const written = await writeAttempt;
    if (!written.ok) {
      options.lifecycle.finishOperation(token);
      return written.error.code === "stale-write"
        ? {
            ok: false,
            error: {
              code: "stale-operation",
              message: written.error.message,
            },
          }
        : written;
    }
    const markedSaved =
      options.lifecycle.markSaved({
        savedSnapshot: snapshot,
        token,
      });
    if (!markedSaved.ok) {
      return {
        ok: false,
        error: {
          code: markedSaved.error.code ===
            "stale-operation"
            ? "stale-operation"
            : "invalid-project",
          message: markedSaved.error.message,
        },
      };
    }
    currentTarget =
      candidateTarget.kind ===
      "native-file-system"
        ? candidateTarget
        : null;
    return {
      ok: true,
      lifecycle: markedSaved.value,
      targetKind: candidateTarget.kind,
      byteLength: encoded.value.byteLength,
    };
  };

  return {
    readTarget: () => currentTarget,
    commitTarget: (target) => {
      currentTarget = target;
    },
    save: () => save(false),
    saveAs: () => save(true),
  };
}
