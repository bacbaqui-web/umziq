import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Scale } from "@/editor/types/types";
import type { ScaleHandleDirection } from "@/editor/types/editorViewTypes";

export type DirectInputState =
  | {
      kind: "rotation";
      x: number;
      y: number;
      value: string;
    }
  | {
      kind: "opacity";
      x: number;
      y: number;
      value: string;
    }
  | {
      kind: "scale";
      handle: ScaleHandleDirection;
      x: number;
      y: number;
      value: string;
    }
  | null;

export type PendingHandleInteraction =
  | {
      kind: "scale";
      handle: ScaleHandleDirection;
      startClientX: number;
      startClientY: number;
    }
  | {
      kind: "rotation";
      startClientX: number;
      startClientY: number;
    }
  | {
      kind: "opacity";
      startClientX: number;
      startClientY: number;
    }
  | {
      kind: "move";
      startClientX: number;
      startClientY: number;
    }
  | null;

export type PendingMotionPathInteraction = {
  frame: number;
  isKeyframe: boolean;
  startClientX: number;
  startClientY: number;
} | null;

type PointHandle = {
  point: {
    x: number;
    y: number;
  };
} | null;

type UsePreviewOverlayStateOptions = {
  currentOpacity: number;
  currentRotation: number;
  currentScale: Scale;
  previewRotationHandle: PointHandle;
  previewOpacityHandle: PointHandle;
  onStartScaleDrag: (handle: ScaleHandleDirection) => void;
  onStartMoveDrag: (clientX: number, clientY: number) => void;
  onStartOpacityDrag: () => void;
  onStartRotationDrag: (clientX: number, clientY: number) => void;
  onStartMotionPathKeyframeDrag: (frame: number, clientX: number, clientY: number) => void;
  onCommitScaleInput: (handle: ScaleHandleDirection, value: number) => void;
  onCommitRotationInput: (value: number) => void;
  onCommitOpacityInput: (value: number) => void;
  dragStartThreshold: number;
};

export function usePreviewOverlayState({
  currentOpacity,
  currentRotation,
  currentScale,
  previewRotationHandle,
  previewOpacityHandle,
  onStartScaleDrag,
  onStartMoveDrag,
  onStartOpacityDrag,
  onStartRotationDrag,
  onStartMotionPathKeyframeDrag,
  onCommitScaleInput,
  onCommitRotationInput,
  onCommitOpacityInput,
  dragStartThreshold,
}: UsePreviewOverlayStateOptions) {
  const [hoveredHandle, setHoveredHandle] = useState<
    ScaleHandleDirection | "rotation" | "opacity" | "move" | null
  >(null);
  const [hoveredMotionFrame, setHoveredMotionFrame] = useState<number | null>(null);
  const [pendingMotionPathInteraction, setPendingMotionPathInteraction] =
    useState<PendingMotionPathInteraction>(null);
  const [suppressedMotionPathClickFrame, setSuppressedMotionPathClickFrame] =
    useState<number | null>(null);
  const [isAnchorHovered, setIsAnchorHovered] = useState(false);
  const [pendingHandleInteraction, setPendingHandleInteraction] =
    useState<PendingHandleInteraction>(null);
  const [directInput, setDirectInput] = useState<DirectInputState>(null);

  useEffect(() => {
    if (!pendingHandleInteraction) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const distance = Math.hypot(
        event.clientX - pendingHandleInteraction.startClientX,
        event.clientY - pendingHandleInteraction.startClientY
      );

      if (distance < dragStartThreshold) {
        return;
      }

      if (pendingHandleInteraction.kind === "scale") {
        onStartScaleDrag(pendingHandleInteraction.handle);
      } else if (pendingHandleInteraction.kind === "rotation") {
        onStartRotationDrag(event.clientX, event.clientY);
      } else if (pendingHandleInteraction.kind === "opacity") {
        onStartOpacityDrag();
      } else {
        onStartMoveDrag(event.clientX, event.clientY);
      }

      setPendingHandleInteraction(null);
    };

    const handleMouseUp = () => {
      setPendingHandleInteraction(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    dragStartThreshold,
    onStartMoveDrag,
    onStartOpacityDrag,
    onStartRotationDrag,
    onStartScaleDrag,
    pendingHandleInteraction,
  ]);

  useEffect(() => {
    if (!pendingMotionPathInteraction) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const distance = Math.hypot(
        event.clientX - pendingMotionPathInteraction.startClientX,
        event.clientY - pendingMotionPathInteraction.startClientY
      );

      if (distance < dragStartThreshold || !pendingMotionPathInteraction.isKeyframe) {
        return;
      }

      onStartMotionPathKeyframeDrag(
        pendingMotionPathInteraction.frame,
        event.clientX,
        event.clientY
      );
      setSuppressedMotionPathClickFrame(pendingMotionPathInteraction.frame);
      setPendingMotionPathInteraction(null);
    };

    const handleMouseUp = () => {
      setPendingMotionPathInteraction(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    dragStartThreshold,
    onStartMotionPathKeyframeDrag,
    pendingMotionPathInteraction,
  ]);

  useEffect(() => {
    if (suppressedMotionPathClickFrame === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuppressedMotionPathClickFrame(null);
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [suppressedMotionPathClickFrame]);

  const openRotationInput = () => {
    if (!previewRotationHandle) {
      return;
    }

    setPendingHandleInteraction(null);
    setDirectInput({
      kind: "rotation",
      x: previewRotationHandle.point.x + 10,
      y: previewRotationHandle.point.y - 12,
      value: `${Math.round(currentRotation)}`,
    });
  };

  const openOpacityInput = () => {
    if (!previewOpacityHandle) {
      return;
    }

    setPendingHandleInteraction(null);
    setDirectInput({
      kind: "opacity",
      x: previewOpacityHandle.point.x + 10,
      y: previewOpacityHandle.point.y - 12,
      value: `${Math.round(currentOpacity)}`,
    });
  };

  const openScaleInput = (handle: ScaleHandleDirection, x: number, y: number) => {
    setPendingHandleInteraction(null);
    const initialValue =
      handle === "x" ? currentScale.x : handle === "y" ? currentScale.y : currentScale.x;
    setDirectInput({
      kind: "scale",
      handle,
      x: x + 10,
      y: y - 12,
      value: `${Math.round(initialValue)}`,
    });
  };

  const closeDirectInput = () => {
    setDirectInput(null);
  };

  const commitDirectInput = () => {
    if (!directInput) {
      return;
    }

    const numericValue = Number(directInput.value);

    if (!Number.isFinite(numericValue)) {
      setDirectInput(null);
      return;
    }

    if (directInput.kind === "rotation") {
      onCommitRotationInput(numericValue);
    } else if (directInput.kind === "opacity") {
      onCommitOpacityInput(numericValue);
    } else {
      onCommitScaleInput(directInput.handle, numericValue);
    }

    setDirectInput(null);
  };

  const handleDirectInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDirectInput();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setDirectInput(null);
    }
  };

  return {
    hoveredHandle,
    setHoveredHandle,
    hoveredMotionFrame,
    setHoveredMotionFrame,
    pendingMotionPathInteraction,
    setPendingMotionPathInteraction,
    suppressedMotionPathClickFrame,
    setSuppressedMotionPathClickFrame,
    isAnchorHovered,
    setIsAnchorHovered,
    pendingHandleInteraction,
    setPendingHandleInteraction,
    directInput,
    setDirectInput,
    openRotationInput,
    openOpacityInput,
    openScaleInput,
    commitDirectInput,
    closeDirectInput,
    handleDirectInputKeyDown,
  };
}
