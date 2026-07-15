import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

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
          260,
          Math.min(520, window.innerWidth - rightPanelWidth - 420)
        );
        setLeftPanelWidth(
          Math.min(maxWidth, Math.max(220, resize.startSize + (event.clientX - resize.startClientX)))
        );
        return;
      }

      if (resize.type === "right") {
        const maxWidth = Math.max(
          280,
          Math.min(520, window.innerWidth - leftPanelWidth - 420)
        );
        setRightPanelWidth(
          Math.min(maxWidth, Math.max(260, resize.startSize + (resize.startClientX - event.clientX)))
        );
        return;
      }

      const maxHeight = Math.max(220, Math.min(480, window.innerHeight - 220));
      setTimelinePanelHeight(
        Math.min(maxHeight, Math.max(220, resize.startSize + (resize.startClientY - event.clientY)))
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
