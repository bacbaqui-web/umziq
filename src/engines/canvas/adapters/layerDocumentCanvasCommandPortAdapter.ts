import type {
  LayerDocumentCanvasCommandPort,
} from "@/engines/canvas/models/layerDocumentCanvasModeModel";

export function createLayerDocumentCanvasCommandPort<
  TCommitResult,
  TSelectionResult,
>(
  options: {
    draft: {
      readonly publish: (command: {
        layerDocumentId: string;
        patch: Parameters<
          LayerDocumentCanvasCommandPort["pointerMove"]
        >[0]["patch"];
        quality: string;
        globalFrame: number;
      }) => ReturnType<
        LayerDocumentCanvasCommandPort["pointerMove"]
      >;
      readonly commitTransform: () => TCommitResult;
      readonly publishMotionPath: (command: {
        layerDocumentId: string;
        globalFrame: number;
        localFrame: number;
        position: {
          readonly x: number;
          readonly y: number;
        };
        quality: string;
      }) => { readonly kind: string } | null;
      readonly commitMotionPath: () => TCommitResult;
      readonly cancel: () => void;
    };
    enterGroup: (
      layerDocumentId: string
    ) => TSelectionResult;
    directSelect: (
      layerDocumentId: string | null
    ) => TSelectionResult;
    selectMotionPathKeyframe: (selection: {
      layerDocumentId: string;
      property: "position";
      localFrame: number;
      globalFrame: number;
    }) => TSelectionResult;
    playback: {
      readonly read: () => {
        readonly currentFrame: number;
      };
      readonly commands: {
        readonly seek: (frame: number) => void;
      };
    };
    quality: string;
  }
): LayerDocumentCanvasCommandPort<
  TCommitResult,
  TSelectionResult,
  TCommitResult
> {
  return {
    pointerMove: (command) =>
      options.draft.publish({
        ...command,
        globalFrame:
          options.playback.read().currentFrame,
      }),
    pointerUp: options.draft.commitTransform,
    cancelDraft: options.draft.cancel,
    directSelect: options.directSelect,
    enterGroup: options.enterGroup,
    publishMotionPathKeyframeDraft: (command) => {
      const preparation =
        options.draft.publishMotionPath({
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
      options.draft.commitMotionPath,
    cancelMotionPathKeyframeDraft:
      options.draft.cancel,
    selectMotionPathKeyframe: (command) =>
      options.selectMotionPathKeyframe({
        layerDocumentId:
          command.layerDocumentId,
        property: "position",
        localFrame: command.localFrame,
        globalFrame: command.globalFrame,
      }),
    seekFrame: (globalFrame) => {
      options.playback.commands.seek(globalFrame);
    },
  };
}
