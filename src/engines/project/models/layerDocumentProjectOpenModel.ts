import type {
  LayerDocumentProject,
  LinkedSourceContentFingerprint,
  SourceRegistryRecord,
} from "@/models";
import type {
  LayerDocumentProjectLifecycleController,
} from "@/engines/project/models/layerDocumentProjectLifecycleModel";
import type {
  LayerDocumentProjectSaveController,
} from "@/engines/project/models/layerDocumentProjectSaveModel";
import type {
  LayerDocumentProjectWritableFileHandle,
} from "@/engines/project/models/layerDocumentProjectBrowserWriteModel";
import type {
  LayerDocumentSourceRuntimeResolutionPort,
} from "@/engines/project/models/layerDocumentSourceRuntimeResolutionModel";
import type {
  LayerDocumentSourceRuntimeResource,
  LayerDocumentSourceRuntimeResourcePort,
} from "@/render";

export type LayerDocumentProjectOpenCapability =
  | "native-file-system"
  | "file-input";

export interface LayerDocumentProjectOpenFileHandle
  extends LayerDocumentProjectWritableFileHandle {
  readonly getFile: () => Promise<File>;
}

export interface LayerDocumentProjectOpenSelection {
  readonly file: File;
  readonly bytes: Uint8Array;
  readonly handle:
    LayerDocumentProjectOpenFileHandle | null;
}

export type LayerDocumentProjectOpenAdapterErrorCode =
  | "cancelled"
  | "permission-denied"
  | "read-failed";

export type LayerDocumentProjectOpenAdapterResult =
  | {
      readonly ok: true;
      readonly value:
        LayerDocumentProjectOpenSelection;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code:
          LayerDocumentProjectOpenAdapterErrorCode;
        readonly message: string;
      };
    };

export interface LayerDocumentProjectBrowserOpenPort {
  readonly capability:
    LayerDocumentProjectOpenCapability;
  readonly chooseProjectFile: () =>
    Promise<LayerDocumentProjectOpenAdapterResult>;
}

export interface LayerDocumentProjectBrowserOpenEnvironment {
  readonly showOpenFilePicker?: (
    options: {
      readonly multiple: false;
      readonly types: readonly {
        readonly description: string;
        readonly accept: Readonly<
          Record<string, readonly string[]>
        >;
      }[];
    }
  ) => Promise<
    readonly LayerDocumentProjectOpenFileHandle[]
  >;
  readonly chooseFileWithHiddenInput: (
    accept: string
  ) => Promise<File | null>;
}

export type LayerDocumentProjectLinkedSourceAccess =
  | {
      readonly status: "available";
      readonly file: File;
      readonly handle:
        FileSystemFileHandle | null;
      readonly permission:
        "unknown" | "prompt" | "granted";
    }
  | {
      readonly status:
        "missing" | "permission-denied" | "error";
      readonly message: string | null;
    };

export interface LayerDocumentProjectLinkedSourceAccessPort {
  readonly find: (options: {
    readonly projectId: string;
    readonly locatorId: string;
  }) => Promise<
    LayerDocumentProjectLinkedSourceAccess
  >;
}

export interface PreparedLayerDocumentLinkedSourceRuntime {
  readonly contentFingerprint:
    LinkedSourceContentFingerprint;
  readonly resources:
    readonly LayerDocumentSourceRuntimeResource[];
  readonly availableSourceIds:
    readonly string[];
  readonly unavailableSourceIds:
    readonly string[];
  readonly discard: () => number;
  readonly transfer: () => void;
}

export type PrepareLayerDocumentLinkedSourceResult =
  | {
      readonly ok: true;
      readonly value:
        PreparedLayerDocumentLinkedSourceRuntime;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

export interface LayerDocumentProjectLinkedSourcePreparationPort {
  readonly prepare: (options: {
    readonly project: LayerDocumentProject;
    readonly source: SourceRegistryRecord;
    readonly file: File;
    readonly bytes?: Uint8Array;
  }) => Promise<
    PrepareLayerDocumentLinkedSourceResult
  >;
}

export type LayerDocumentProjectOpenReadiness =
  | "ready"
  | "ready-degraded";

export type LayerDocumentProjectOpenErrorCode =
  | LayerDocumentProjectOpenAdapterErrorCode
  | "invalid-project"
  | "stale-operation"
  | "runtime-registration-failed";

export type LayerDocumentProjectOpenResult =
  | {
      readonly ok: true;
      readonly readiness:
        LayerDocumentProjectOpenReadiness;
      readonly project: LayerDocumentProject;
      readonly missingSourceIds:
        readonly string[];
      readonly errorSourceIds:
        readonly string[];
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code:
          LayerDocumentProjectOpenErrorCode;
        readonly message: string;
      };
    };

export interface LayerDocumentProjectOpenController {
  readonly open: () =>
    Promise<LayerDocumentProjectOpenResult>;
}

export interface CreateLayerDocumentProjectOpenControllerOptions {
  readonly lifecycle:
    LayerDocumentProjectLifecycleController;
  readonly browser:
    LayerDocumentProjectBrowserOpenPort;
  readonly linkedSourceAccess:
    LayerDocumentProjectLinkedSourceAccessPort;
  readonly linkedSourcePreparation:
    LayerDocumentProjectLinkedSourcePreparationPort;
  readonly sourceRuntime:
    LayerDocumentSourceRuntimeResourcePort;
  readonly sourceResolution:
    LayerDocumentSourceRuntimeResolutionPort;
  readonly saveController?:
    Pick<
      LayerDocumentProjectSaveController,
      "commitTarget"
    >;
}
