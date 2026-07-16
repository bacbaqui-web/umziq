import { useProjectCommands, useProjectHistory } from "@/engines/project";
import { useEditorSessionState } from "@/editor/state/useEditorSessionState";
import { useEditorShellLayoutState } from "@/editor/state/useEditorShellLayoutState";
import {
  useEditorCanvasState,
  useEditorPlaybackState,
  useEditorProjectState,
  useEditorTimelineState,
} from "@/editor/state/useEditorEngineStateStores";

type UseEditorStateOptions = {
  masterDefaultWidth: number;
  masterDefaultHeight: number;
  previewMinWorkspaceWidth: number;
  previewMinWorkspaceHeight: number;
};

export function useEditorState({
  masterDefaultWidth,
  masterDefaultHeight,
  previewMinWorkspaceWidth,
  previewMinWorkspaceHeight,
}: UseEditorStateOptions) {
  const projectState = useEditorProjectState(masterDefaultWidth, masterDefaultHeight);
  const editorSessionState = useEditorSessionState();
  const playbackState = useEditorPlaybackState();
  const canvasState = useEditorCanvasState(previewMinWorkspaceWidth, previewMinWorkspaceHeight);
  const timelineState = useEditorTimelineState();
  const shellLayoutState = useEditorShellLayoutState();

  const projectCommands = useProjectCommands({
    setComps: projectState.setComps,
    setMetaByCompId: projectState.setMetaByCompId,
    setTimelineItemsByCompId: projectState.setTimelineItemsByCompId,
    setRenderItemsByCompId: projectState.setRenderItemsByCompId,
  });

  const historyController = useProjectHistory({
    readState: {
      comps: projectState.comps,
      masterEnabledProperties: projectState.masterEnabledProperties,
      masterScale: projectState.masterScale,
      masterScaleKeyframes: projectState.masterScaleKeyframes,
      masterScaleLinked: projectState.masterScaleLinked,
      masterRotation: projectState.masterRotation,
      masterRotationKeyframes: projectState.masterRotationKeyframes,
      masterOpacity: projectState.masterOpacity,
      masterOpacityKeyframes: projectState.masterOpacityKeyframes,
      selectedLayerId: editorSessionState.selectedLayerId,
      selectedTimelineTarget: editorSessionState.selectedTimelineTarget,
      lastSelectedItemByCompId: editorSessionState.lastSelectedItemByCompId,
      metaByCompId: projectState.metaByCompId,
      playbackRangeByCompId: playbackState.playbackRangeByCompId,
      timelineItemsByCompId: projectState.timelineItemsByCompId,
      renderItemsByCompId: projectState.renderItemsByCompId,
      currentFrame: playbackState.currentFrame,
    },
    restorePort: {
      setComps: projectState.setComps,
      setMasterEnabledProperties: projectState.setMasterEnabledProperties,
      setMasterScale: projectState.setMasterScale,
      setMasterScaleKeyframes: projectState.setMasterScaleKeyframes,
      setMasterScaleLinked: projectState.setMasterScaleLinked,
      setMasterRotation: projectState.setMasterRotation,
      setMasterRotationKeyframes: projectState.setMasterRotationKeyframes,
      setMasterOpacity: projectState.setMasterOpacity,
      setMasterOpacityKeyframes: projectState.setMasterOpacityKeyframes,
      setSelectedCompId: editorSessionState.setSelectedCompId,
      setSelectedLayerId: editorSessionState.setSelectedLayerId,
      setSelectedTimelineTarget: editorSessionState.setSelectedTimelineTarget,
      setLastSelectedItemByCompId: editorSessionState.setLastSelectedItemByCompId,
      setSelectedKeyframe: editorSessionState.setSelectedKeyframe,
      setPositionDraft: editorSessionState.setPositionDraft,
      setScaleDraft: editorSessionState.setScaleDraft,
      setRotationDraft: editorSessionState.setRotationDraft,
      setOpacityDraft: editorSessionState.setOpacityDraft,
      setMetaByCompId: projectState.setMetaByCompId,
      setPlaybackRangeByCompId: playbackState.setPlaybackRangeByCompId,
      setTimelineItemsByCompId: projectState.setTimelineItemsByCompId,
      setRenderItemsByCompId: projectState.setRenderItemsByCompId,
      setImportError: editorSessionState.setImportError,
      setImportNotice: editorSessionState.setImportNotice,
      setDraggedTimelineItemId: timelineState.setDraggedTimelineItemId,
      setCurrentFrame: playbackState.setCurrentFrame,
      setIsScrubbingTimeline: timelineState.setIsScrubbingTimeline,
      setIsPlaying: playbackState.setIsPlaying,
      setHoveredFrame: timelineState.setHoveredFrame,
      setDraggingKeyframe: timelineState.setDraggingKeyframe,
      setRotationHandleReadout: canvasState.setRotationHandleReadout,
      setOpacityHandleReadout: canvasState.setOpacityHandleReadout,
      setScaleHandleReadout: canvasState.setScaleHandleReadout,
      setPositionHandleReadout: canvasState.setPositionHandleReadout,
      setMotionPathKeyframeReadout:
        canvasState.setMotionPathKeyframeReadout,
      setDraggingMotionPathFrame: canvasState.setDraggingMotionPathFrame,
    },
  });

  return {
    ...projectState,
    ...editorSessionState,
    ...playbackState,
    ...canvasState,
    ...timelineState,
    ...shellLayoutState,
    projectCommands,
    ...historyController,
  };
}
