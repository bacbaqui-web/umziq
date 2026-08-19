import type {
  LayerDocumentProject,
} from "@/models";
import type {
  ProjectStorageErrorCode,
  ProjectStorageTarget,
  ProjectWritePort,
} from "@/gateway/contracts/projectStorageGateway";
import type {
  LayerDocumentProjectLifecycleController,
  LayerDocumentProjectLifecycleState,
} from "@/engines/project/models/layerDocumentProjectLifecycleModel";

export type LayerDocumentProjectSaveErrorCode =
  | ProjectStorageErrorCode
  | "invalid-project"
  | "stale-operation";

export type LayerDocumentProjectSaveResult =
  | {
      readonly ok: true;
      readonly lifecycle:
        LayerDocumentProjectLifecycleState;
      readonly targetKind:
        ProjectStorageTarget["kind"];
      readonly byteLength: number;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code:
          LayerDocumentProjectSaveErrorCode;
        readonly message: string;
      };
    };

export interface LayerDocumentProjectSaveController {
  readonly readTarget: () =>
    ProjectStorageTarget | null;
  readonly commitTarget: (
    target: ProjectStorageTarget | null
  ) => void;
  readonly save: () =>
    Promise<LayerDocumentProjectSaveResult>;
  readonly saveAs: () =>
    Promise<LayerDocumentProjectSaveResult>;
}

export interface CreateLayerDocumentProjectSaveControllerOptions {
  readonly readProject: () =>
    LayerDocumentProject;
  readonly lifecycle:
    LayerDocumentProjectLifecycleController;
  readonly storage: ProjectWritePort;
}
