import type {
  LayerDocumentProject,
  LayerDocumentTransactionResult,
} from "@/models";
import type {
  LayerDocumentAudioPreparationPort,
} from "@/layer-types/audioSupport";
import type {
  LayerDocumentDrawingPreparationPort,
} from "@/layer-types/drawingSupport";
import type {
  LayerDocumentTextPreparationPort,
} from "@/layer-types/textSupport";

export function createLayerTypeOwnerCommandAdapter<
  TCommandResult,
>(options: {
  readProject: () => LayerDocumentProject;
  drawing: LayerDocumentDrawingPreparationPort;
  text: LayerDocumentTextPreparationPort;
  audio: LayerDocumentAudioPreparationPort;
  commit: (
    preparation: LayerDocumentTransactionResult
  ) => TCommandResult;
}) {
  return {
    drawing: {
      query: (layerDocumentId: string) =>
        options.drawing.query(
          options.readProject(),
          layerDocumentId
        ),
      update: (
        command: Parameters<
          LayerDocumentDrawingPreparationPort[
            "prepareUpdate"
          ]
        >[1]
      ) =>
        options.commit(
          options.drawing.prepareUpdate(
            options.readProject(),
            command
          )
        ),
    },
    text: {
      query: (layerDocumentId: string) =>
        options.text.query(
          options.readProject(),
          layerDocumentId
        ),
      update: (
        command: Parameters<
          LayerDocumentTextPreparationPort[
            "prepareUpdate"
          ]
        >[1]
      ) =>
        options.commit(
          options.text.prepareUpdate(
            options.readProject(),
            command
          )
        ),
    },
    audio: {
      query: (layerDocumentId: string) =>
        options.audio.query(
          options.readProject(),
          layerDocumentId
        ),
      update: (
        command: Parameters<
          LayerDocumentAudioPreparationPort[
            "prepareUpdate"
          ]
        >[1]
      ) =>
        options.commit(
          options.audio.prepareUpdate(
            options.readProject(),
            command
          )
        ),
    },
  };
}
