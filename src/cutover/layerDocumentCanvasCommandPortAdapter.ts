import type {
  LayerDocumentCanvasCommandPort,
} from "@/engines/canvas";
import type {
  LayerDocumentConsumerCutoverAssembly,
  LayerDocumentCutoverCommandResult,
} from "@/cutover/layerDocumentConsumerCutoverModel";
import type {
  LayerDocumentPanelCommandPreparation,
} from "@/engines/properties";

type CommitResult =
  LayerDocumentCutoverCommandResult<
    LayerDocumentPanelCommandPreparation
  >;
type SelectionResult =
  LayerDocumentCutoverCommandResult;

/**
 * Concrete command wiring for the native Canvas hook. It delegates to the
 * single cutover assembly DraftSession/owner and creates no Canvas-side
 * Project, History, or Runtime authority.
 */
export function createLayerDocumentCanvasCutoverCommandPort(
  options: {
    assembly: LayerDocumentConsumerCutoverAssembly;
    quality: string;
  }
): LayerDocumentCanvasCommandPort<
  CommitResult,
  SelectionResult,
  CommitResult
> {
  return {
    pointerMove: options.assembly.canvas.pointerMove,
    pointerUp: options.assembly.canvas.pointerUp,
    cancelDraft: options.assembly.canvas.cancelDraft,
    directSelect:
      options.assembly.canvas.directSelect,
    enterGroup: options.assembly.scope.enter,
    publishMotionPathKeyframeDraft: (command) => {
      const preparation =
        options.assembly.canvas
          .motionPathPointerMove({
            layerDocumentId:
              command.layerDocumentId,
            globalFrame: command.globalFrame,
            localFrame: command.localFrame,
            position: command.value,
            quality: options.quality,
          });
      return preparation?.kind === "pointer-move"
        ? {
            kind: "motion-path-keyframe-draft",
            layerDocumentId:
              command.layerDocumentId,
            globalFrame: command.globalFrame,
            localFrame: command.localFrame,
            value: command.value,
            projectUpdateCount: 0,
            transactionCount: 0,
            historyEntryCount: 0,
          }
        : null;
    },
    commitMotionPathKeyframeDraft:
      options.assembly.canvas.motionPathPointerUp,
    cancelMotionPathKeyframeDraft:
      options.assembly.canvas.cancelDraft,
    selectMotionPathKeyframe: (command) =>
      options.assembly.canvas
        .selectMotionPathKeyframe({
          layerDocumentId:
            command.layerDocumentId,
          property: "position",
          localFrame: command.localFrame,
          globalFrame: command.globalFrame,
        }),
    seekFrame: (globalFrame) => {
      const playback =
        options.assembly.playback.read();
      options.assembly.playback.set({
        ...playback,
        currentFrame: globalFrame,
      });
    },
  };
}
