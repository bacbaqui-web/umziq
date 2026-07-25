import type {
  LayerDocumentProjectLifecycleController,
  LayerDocumentProjectOpenController,
  LayerDocumentProjectReconnectController,
  LayerDocumentProjectReconnectReadItem,
  LayerDocumentProjectSaveController,
} from "@/engines/project";
import type {
  LayerDocumentProject,
} from "@/models";

export type ProjectLifecycleUiNotice = {
  readonly tone: "info" | "warning" | "error";
  readonly code: string;
  readonly message: string;
} | null;

export interface ProjectLifecycleUiViewModel {
  readonly document: "untitled" | "file-backed";
  readonly dirty: "clean" | "dirty";
  readonly operation: "idle" | "saving" | "loading";
  readonly commandsDisabled: boolean;
  readonly missingSources:
    readonly LayerDocumentProjectReconnectReadItem[];
  readonly notice: ProjectLifecycleUiNotice;
}

export interface ProjectLifecycleUiCommandPort {
  readonly read: () => ProjectLifecycleUiViewModel;
  readonly newProject: () => Promise<void>;
  readonly openProject: () => Promise<void>;
  readonly saveProject: () => Promise<void>;
  readonly saveProjectAs: () => Promise<void>;
  readonly closeProject: () => Promise<void>;
  readonly reconnectSource: (
    sourceId: string
  ) => Promise<void>;
}

type DestructiveIntent =
  | "new-project"
  | "open-project"
  | "close-project";

export function createProjectLifecycleUiCommandPort(
  options: {
    readonly lifecycle:
      LayerDocumentProjectLifecycleController;
    readonly save:
      LayerDocumentProjectSaveController;
    readonly open:
      LayerDocumentProjectOpenController;
    readonly reconnect:
      LayerDocumentProjectReconnectController;
    readonly createNewProject: () =>
      LayerDocumentProject;
    readonly confirmDiscard: (
      intent: DestructiveIntent
    ) => boolean | Promise<boolean>;
    readonly notify: () => void;
  }
): ProjectLifecycleUiCommandPort {
  let notice: ProjectLifecycleUiNotice = null;
  const setNotice = (
    next: ProjectLifecycleUiNotice
  ) => {
    notice = next;
    options.notify();
  };
  const confirmIfDirty = async (
    intent: DestructiveIntent
  ) => {
    if (
      options.lifecycle.read().dirty === "clean"
    ) return true;
    const confirmed =
      await options.confirmDiscard(intent);
    if (!confirmed) {
      setNotice({
        tone: "info",
        code: "cancelled",
        message:
          "현재 프로젝트를 그대로 유지했습니다.",
      });
    }
    return confirmed;
  };
  const replaceWithBlank = async (
    intent: "new-project" | "close-project"
  ) => {
    if (!await confirmIfDirty(intent)) return;
    const replaced =
      options.lifecycle.replaceProject({
        project: options.createNewProject(),
        document: "untitled",
      });
    if (!replaced.ok) {
      setNotice({
        tone: "error",
        code: replaced.error.code,
        message: replaced.error.message,
      });
      return;
    }
    options.save.commitTarget(null);
    setNotice({
      tone: "info",
      code: intent,
      message:
        intent === "new-project"
          ? "새 프로젝트를 만들었습니다."
          : "프로젝트를 닫았습니다.",
    });
  };
  const runSave = async (
    save: () => ReturnType<
      LayerDocumentProjectSaveController["save"]
    >
  ) => {
    const pending = save();
    options.notify();
    const result = await pending;
    if (!result.ok) {
      setNotice({
        tone:
          result.error.code === "cancelled"
            ? "info"
            : "error",
        code: result.error.code,
        message: result.error.message,
      });
      return;
    }
    setNotice({
      tone: "info",
      code: "saved",
      message: "프로젝트를 저장했습니다.",
    });
  };
  return {
    read: () => {
      const lifecycle = options.lifecycle.read();
      return {
        document: lifecycle.document,
        dirty: lifecycle.dirty,
        operation: lifecycle.operation,
        commandsDisabled:
          lifecycle.operation !== "idle",
        missingSources:
          options.reconnect.read().items,
        notice,
      };
    },
    newProject: () =>
      replaceWithBlank("new-project"),
    openProject: async () => {
      if (!await confirmIfDirty("open-project")) {
        return;
      }
      const pending = options.open.open();
      options.notify();
      const result = await pending;
      if (!result.ok) {
        setNotice({
          tone:
            result.error.code === "cancelled"
              ? "info"
              : "error",
          code: result.error.code,
          message: result.error.message,
        });
        return;
      }
      setNotice({
        tone:
          result.readiness === "ready"
            ? "info"
            : "warning",
        code: result.readiness,
        message:
          result.readiness === "ready"
            ? "프로젝트를 열었습니다."
            : "프로젝트를 열었지만 일부 연결 소스가 필요합니다.",
      });
    },
    saveProject: () =>
      runSave(options.save.save),
    saveProjectAs: () =>
      runSave(options.save.saveAs),
    closeProject: () =>
      replaceWithBlank("close-project"),
    reconnectSource: async (sourceId) => {
      const pending =
        options.reconnect.reconnect(sourceId);
      options.notify();
      const result = await pending;
      if (!result.ok) {
        setNotice({
          tone:
            result.error.code === "cancelled"
              ? "info"
              : "error",
          code: result.error.code,
          message: result.error.message,
        });
        return;
      }
      if (
        result.status ===
        "confirmation-required"
      ) {
        setNotice({
          tone: "warning",
          code: result.reason,
          message:
            "파일 지문을 자동 승인할 수 없습니다. 소스 새로고침 또는 교체 흐름에서 확인해 주세요.",
        });
        return;
      }
      setNotice({
        tone: "info",
        code: "reconnected",
        message: "연결 소스를 복구했습니다.",
      });
    },
  };
}
