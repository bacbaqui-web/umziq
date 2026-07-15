import { useEditorSelectionModel } from "@/editor/state/useEditorSelectionModel";
import { useEditorState } from "@/editor/state/useEditorState";
import {
  ANIMATABLE_PROPERTIES,
  DEFAULT_FRAME_RATE,
  MASTER_COMP_ID,
  MASTER_DEFAULT_HEIGHT,
  MASTER_DEFAULT_WIDTH,
  PREVIEW_MIN_WORKSPACE_HEIGHT,
  PREVIEW_MIN_WORKSPACE_WIDTH,
} from "@/editor/editorShellConstants";

export function useEditorShellModels() {
  const editorState = useEditorState({
    masterDefaultWidth: MASTER_DEFAULT_WIDTH,
    masterDefaultHeight: MASTER_DEFAULT_HEIGHT,
    previewMinWorkspaceWidth: PREVIEW_MIN_WORKSPACE_WIDTH,
    previewMinWorkspaceHeight: PREVIEW_MIN_WORKSPACE_HEIGHT,
  });

  const selectionModel = useEditorSelectionModel({
    masterCompId: MASTER_COMP_ID,
    masterWidth: MASTER_DEFAULT_WIDTH,
    masterHeight: MASTER_DEFAULT_HEIGHT,
    defaultFrameRate: DEFAULT_FRAME_RATE,
    animatableProperties: ANIMATABLE_PROPERTIES,
    comps: editorState.comps,
    masterEnabledProperties: editorState.masterEnabledProperties,
    masterAnchor: editorState.masterAnchor,
    masterScale: editorState.masterScale,
    masterScaleKeyframes: editorState.masterScaleKeyframes,
    masterScaleLinked: editorState.masterScaleLinked,
    masterRotation: editorState.masterRotation,
    masterRotationKeyframes: editorState.masterRotationKeyframes,
    masterOpacity: editorState.masterOpacity,
    masterOpacityKeyframes: editorState.masterOpacityKeyframes,
    selectedCompId: editorState.selectedCompId,
    selectedLayerId: editorState.selectedLayerId,
    selectedTimelineTarget: editorState.selectedTimelineTarget,
    metaByCompId: editorState.metaByCompId,
    timelineItemsByCompId: editorState.timelineItemsByCompId,
  });

  return {
    editorState,
    selectionModel,
  };
}
