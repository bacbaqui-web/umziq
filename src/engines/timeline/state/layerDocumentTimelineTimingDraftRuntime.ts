import type {
  LayerDocument,
  LayerDocumentProject,
} from "@/models";
import type {
  LayerDocumentTimelineTimingDraft,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";

export interface LayerDocumentTimelineTimingDraftRuntime {
  readonly read: () =>
    LayerDocumentTimelineTimingDraft | null;
  readonly subscribe: (
    listener: () => void
  ) => () => void;
  readonly publish: (
    draft: LayerDocumentTimelineTimingDraft
  ) => void;
  readonly clear: () => void;
}

export function createLayerDocumentTimelineTimingDraftRuntime():
LayerDocumentTimelineTimingDraftRuntime {
  let draft:
    LayerDocumentTimelineTimingDraft | null = null;
  const listeners = new Set<() => void>();
  const replace = (
    next: LayerDocumentTimelineTimingDraft | null
  ) => {
    if (draft === next) return;
    draft = next;
    listeners.forEach((listener) => listener());
  };
  return {
    read: () => draft,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish: (next) => replace(next),
    clear: () => replace(null),
  };
}

export function projectLayerDocumentTimelineTimingDraft(
  project: LayerDocumentProject,
  draft: LayerDocumentTimelineTimingDraft | null
): LayerDocumentProject {
  if (!draft) return project;
  const layer =
    project.payload.layerDocumentsById[
      draft.layerDocumentId
    ];
  if (!layer) return project;
  return {
    ...project,
    payload: {
      ...project.payload,
      layerDocumentsById: {
        ...project.payload.layerDocumentsById,
        [layer.layerDocumentId]: {
          ...layer,
          common: {
            ...layer.common,
            placement: {
              ...layer.common.placement,
              startFrame: draft.startFrame,
              durationFrames: draft.durationFrames,
              sourceOffsetFrames:
                draft.sourceOffsetFrames,
            },
          },
        } as LayerDocument,
      },
    },
  };
}
