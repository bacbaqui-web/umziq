import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type GroupLayerDocument,
  type LayerDocumentProject,
} from "@/models";
import {
  DEFAULT_FRAME_RATE,
  MASTER_DEFAULT_HEIGHT,
  MASTER_DEFAULT_WIDTH,
  type CreateLayerDocumentProjectOwnerOptions,
} from "@/engines/project";

export const LAYER_DOCUMENT_EDITOR_PROJECT_ID =
  "shortform-editor-project";
const INITIAL_ROOT_LAYER_DOCUMENT_ID =
  "layer-document:project-root";

export function createInitialLayerDocumentOwnerOptions():
CreateLayerDocumentProjectOwnerOptions {
  const durationFrames = DEFAULT_FRAME_RATE * 10;
  const root: GroupLayerDocument = {
    layerDocumentId: INITIAL_ROOT_LAYER_DOCUMENT_ID,
    name: "Master",
    revision: 0,
    type: "group",
    common: {
      source: null,
      transform: {
        position: {
          x: MASTER_DEFAULT_WIDTH / 2,
          y: MASTER_DEFAULT_HEIGHT / 2,
        },
        transformOffset: { x: 0, y: 0 },
        anchor: {
          x: MASTER_DEFAULT_WIDTH / 2,
          y: MASTER_DEFAULT_HEIGHT / 2,
        },
        scale: { x: 100, y: 100 },
        scaleLinked: true,
        rotation: 0,
        opacity: 100,
      },
      placement: {
        parentLayerDocumentId: null,
        order: 0,
        startFrame: 0,
        durationFrames,
        sourceOffsetFrames: 0,
        visible: true,
        alias: null,
      },
      animation: {
        positionKeyframes: [],
        scaleKeyframes: [],
        rotationKeyframes: [],
        opacityKeyframes: [],
        enabledProperties: {
          position: false,
          scale: false,
          rotation: false,
          opacity: false,
        },
      },
      effects: [],
      modifiers: [],
    },
    data: {
      role: "project-root",
      width: MASTER_DEFAULT_WIDTH,
      height: MASTER_DEFAULT_HEIGHT,
      frameRate: DEFAULT_FRAME_RATE,
      durationFrames,
    },
  };
  const project: LayerDocumentProject = {
    metadata: {
      schemaVersion:
        LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: LAYER_DOCUMENT_EDITOR_PROJECT_ID,
      name: "Shortform Editor Project",
    },
    payload: {
      layerDocumentsById: {
        [root.layerDocumentId]: root,
      },
      sourceRegistry: { sourcesById: {} },
    },
  };
  return {
    project,
    layerSelection: {
      kind: "layer-document",
      layerDocumentId: root.layerDocumentId,
    },
    activeGroupLayerDocumentId:
      root.layerDocumentId,
  };
}
