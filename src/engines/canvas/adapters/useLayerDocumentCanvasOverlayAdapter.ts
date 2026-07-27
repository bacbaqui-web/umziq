import type { Scale } from "@/models";
import {
  useCanvasGizmoController,
} from "@/engines/canvas/controllers/useCanvasGizmoController";
import type {
  CanvasInteractionStatePort,
} from "@/engines/canvas/models/canvasInteractionModel";
import type {
  LayerDocumentCanvasReadModel,
} from "@/engines/canvas/models/layerDocumentCanvasReadModel";
import type {
  ScaleHandleDirection,
} from "@/engines/canvas/models/canvasViewModel";

/**
 * Adapts the LayerDocument-native read/interaction ports to the exact
 * identity-neutral Gizmo/MotionPath VM consumed by PreviewWorkspacePane.
 */
export function useLayerDocumentCanvasOverlayAdapter(options: {
  readModel: LayerDocumentCanvasReadModel;
  state: CanvasInteractionStatePort;
  transform: {
    startPositionDrag: (clientX: number, clientY: number) => void;
    startScaleDrag: (
      handle: ScaleHandleDirection,
      clientX: number,
      clientY: number
    ) => void;
    startRotationDrag: (clientX: number, clientY: number) => void;
    startOpacityDrag: () => void;
    startAnchorDrag: () => void;
  };
  pressTarget: (clientX: number, clientY: number) => void;
  motion: {
    selectPoint: (
      frame: number,
      isKeyframe: boolean
    ) => void;
    startKeyframeDrag: (
      frame: number,
      clientX: number,
      clientY: number
    ) => void;
  };
  directInput: {
    commitScale: (
      handle: ScaleHandleDirection,
      value: number
    ) => void;
    commitRotation: (value: number) => void;
    commitOpacity: (value: number) => void;
  };
}) {
  const target = options.readModel.selectedTarget;
  const transform = target?.gizmo.evaluatedTransform;
  return useCanvasGizmoController({
    viewportScale:
      options.readModel.viewport.viewportScale,
    viewportOffset:
      options.readModel.viewport.viewportOffset,
    previewSize:
      options.readModel.viewport.previewSize,
    selectedMeta: {
      width: options.readModel.activeScene.width,
      height: options.readModel.activeScene.height,
    },
    selection: options.readModel.selection,
    motionPath: [...options.readModel.motionPath],
    currentOpacity: target?.gizmo.opacity ?? 100,
    currentRotation: transform?.rotation ?? 0,
    currentScale:
      transform?.scale ?? ({ x: 100, y: 100 } satisfies Scale),
    state: options.state,
    transform: options.transform,
    pressTarget: options.pressTarget,
    motion: options.motion,
    directInput: options.directInput,
  });
}
