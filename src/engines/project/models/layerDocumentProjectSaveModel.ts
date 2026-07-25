import type {
  LayerDocumentProject,
} from "@/models";
import type {
  LayerDocumentProjectBrowserWritePort,
  LayerDocumentProjectWriteErrorCode,
  LayerDocumentProjectWriteTarget,
} from "@/engines/project/models/layerDocumentProjectBrowserWriteModel";
import type {
  LayerDocumentProjectLifecycleController,
  LayerDocumentProjectLifecycleState,
} from "@/engines/project/models/layerDocumentProjectLifecycleModel";

export type LayerDocumentProjectSaveErrorCode =
  | LayerDocumentProjectWriteErrorCode
  | "invalid-project"
  | "stale-operation";

export type LayerDocumentProjectSaveResult =
  | {
      readonly ok: true;
      readonly lifecycle:
        LayerDocumentProjectLifecycleState;
      readonly targetKind:
        LayerDocumentProjectWriteTarget["kind"];
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
    LayerDocumentProjectWriteTarget | null;
  readonly commitTarget: (
    target: LayerDocumentProjectWriteTarget | null
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
  readonly browser:
    LayerDocumentProjectBrowserWritePort;
}
