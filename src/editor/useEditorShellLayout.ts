import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import {
  SHELL_CENTER_MIN_WIDTH,
  SHELL_LEFT_PANEL_MAX_FLOOR_WIDTH,
  SHELL_LEFT_PANEL_MIN_WIDTH,
  SHELL_MAIN_AREA_MIN_HEIGHT,
  SHELL_RIGHT_PANEL_MAX_FLOOR_WIDTH,
  SHELL_RIGHT_PANEL_MIN_WIDTH,
  SHELL_SIDE_PANEL_MAX_WIDTH,
  SHELL_TIMELINE_PANEL_MAX_HEIGHT,
  SHELL_TIMELINE_PANEL_MIN_HEIGHT,
} from "@/editor/editorShellLayoutConstants";

type PanelResizeType = "left" | "right" | "bottom";

type UseEditorShellLayoutOptions = {
  leftPanelWidth: number;
  rightPanelWidth: number;
  setLeftPanelWidth: Dispatch<SetStateAction<number>>;
  setRightPanelWidth: Dispatch<SetStateAction<number>>;
  setTimelinePanelHeight: Dispatch<SetStateAction<number>>;
  activePanelResize: PanelResizeType | null;
  setActivePanelResize: Dispatch<SetStateAction<PanelResizeType | null>>;
  isDraggingAnchor: boolean;
  isDraggingPosition: boolean;
  isDraggingMotionPathKeyframe: boolean;
  isDraggingRotation: boolean;
  isPreviewPanning: boolean;
};

export function useEditorShellLayout({
  leftPanelWidth,
  rightPanelWidth,
  setLeftPanelWidth,
  setRightPanelWidth,
  setTimelinePanelHeight,
  activePanelResize,
  setActivePanelResize,
  isDraggingAnchor,
  isDraggingPosition,
  isDraggingMotionPathKeyframe,
  isDraggingRotation,
  isPreviewPanning,
}: UseEditorShellLayoutOptions) {
  const panelResizeRef = useRef<{
    type: PanelResizeType;
    startClientX: number;
    startClientY: number;
    startSize: number;
  } | null>(null);

  const startPanelResize = (
    type: PanelResizeType,
    startClientX: number,
    startClientY: number,
    startSize: number
  ) => {
    panelResizeRef.current = {
      type,
      startClientX,
      startClientY,
      startSize,
    };
    setActivePanelResize(type);
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const resize = panelResizeRef.current;

      if (!resize) {
        return;
      }

      if (resize.type === "left") {
        const maxWidth = Math.max(
          SHELL_LEFT_PANEL_MAX_FLOOR_WIDTH,
          Math.min(
            SHELL_SIDE_PANEL_MAX_WIDTH,
            window.innerWidth - rightPanelWidth - SHELL_CENTER_MIN_WIDTH
          )
        );
        setLeftPanelWidth(
          Math.min(
            maxWidth,
            Math.max(
              SHELL_LEFT_PANEL_MIN_WIDTH,
              resize.startSize + (event.clientX - resize.startClientX)
            )
          )
        );
        return;
      }

      if (resize.type === "right") {
        const maxWidth = Math.max(
          SHELL_RIGHT_PANEL_MAX_FLOOR_WIDTH,
          Math.min(
            SHELL_SIDE_PANEL_MAX_WIDTH,
            window.innerWidth - leftPanelWidth - SHELL_CENTER_MIN_WIDTH
          )
        );
        setRightPanelWidth(
          Math.min(
            maxWidth,
            Math.max(
              SHELL_RIGHT_PANEL_MIN_WIDTH,
              resize.startSize + (resize.startClientX - event.clientX)
            )
          )
        );
        return;
      }

      const maxHeight = Math.max(
        SHELL_TIMELINE_PANEL_MIN_HEIGHT,
        Math.min(
          SHELL_TIMELINE_PANEL_MAX_HEIGHT,
          window.innerHeight - SHELL_MAIN_AREA_MIN_HEIGHT
        )
      );
      setTimelinePanelHeight(
        Math.min(
          maxHeight,
          Math.max(
            SHELL_TIMELINE_PANEL_MIN_HEIGHT,
            resize.startSize + (resize.startClientY - event.clientY)
          )
        )
      );
    };

    const handleMouseUp = () => {
      panelResizeRef.current = null;
      setActivePanelResize(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    leftPanelWidth,
    rightPanelWidth,
    setActivePanelResize,
    setLeftPanelWidth,
    setRightPanelWidth,
    setTimelinePanelHeight,
  ]);

  useEffect(() => {
    document.body.style.cursor = isDraggingAnchor
      ? "none"
      : activePanelResize === "bottom"
        ? "row-resize"
        : activePanelResize
          ? "col-resize"
          : isPreviewPanning
            ? "grabbing"
            : isDraggingPosition
              ? "grabbing"
              : isDraggingMotionPathKeyframe
                ? "grabbing"
                : isDraggingRotation
                  ? "grabbing"
                  : "";
    document.body.style.userSelect = activePanelResize ? "none" : "";

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [
    activePanelResize,
    isDraggingAnchor,
    isDraggingMotionPathKeyframe,
    isDraggingPosition,
    isDraggingRotation,
    isPreviewPanning,
  ]);

  return {
    panelResizeRef,
    startPanelResize,
  };
}
