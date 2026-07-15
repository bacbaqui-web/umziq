import { useEffect, useEffectEvent, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { CompositionMeta, Position } from "@/editor/types/types";
import { getCenteredPreviewPan } from "@/editor/preview/previewCamera";
import { getPreviewViewportValues } from "@/features/preview/geometry/previewViewportValues";
import { usePreviewPanInteractions } from "@/features/preview/interaction/usePreviewPanInteractions";
import { usePreviewViewportCommands } from "@/features/preview/hooks/usePreviewViewportCommands";
import { usePreviewWorkspaceResize } from "@/features/preview/hooks/usePreviewWorkspaceResize";

type UsePreviewViewportOptions = {
  previewMinWorkspaceWidth: number;
  previewMinWorkspaceHeight: number;
  shortformFrameWidth: number;
  shortformFrameHeight: number;
  selectedCompId: string;
  selectedMeta: CompositionMeta | null;
  previewWorkspaceSize: {
    width: number;
    height: number;
  };
  previewZoom: number;
  previewPan: Position;
  setPreviewWorkspaceSize: Dispatch<
    SetStateAction<{
      width: number;
      height: number;
    }>
  >;
  setPreviewZoom: Dispatch<SetStateAction<number>>;
  setPreviewPan: Dispatch<SetStateAction<Position>>;
  setIsPreviewPanning: Dispatch<SetStateAction<boolean>>;
  setIsPreviewPanModifierActive: Dispatch<SetStateAction<boolean>>;
};

export function usePreviewViewport({
  previewMinWorkspaceWidth,
  previewMinWorkspaceHeight,
  shortformFrameWidth,
  shortformFrameHeight,
  selectedCompId,
  selectedMeta,
  previewWorkspaceSize,
  previewZoom,
  previewPan,
  setPreviewWorkspaceSize,
  setPreviewZoom,
  setPreviewPan,
  setIsPreviewPanning,
  setIsPreviewPanModifierActive,
}: UsePreviewViewportOptions) {
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const pendingInitialPreviewViewRef = useRef(false);
  const previewPanDragRef = useRef<{
    source: "space" | "middle";
    startClientX: number;
    startClientY: number;
    startPan: Position;
  } | null>(null);
  const previewPanModifierRef = useRef(false);

  const viewportValues = useMemo(
    () =>
      getPreviewViewportValues({
        previewMinWorkspaceWidth,
        previewMinWorkspaceHeight,
        previewWorkspaceSize,
        selectedMeta,
        shortformFrameWidth,
        shortformFrameHeight,
        previewZoom,
        previewPan,
      }),
    [
      previewMinWorkspaceHeight,
      previewMinWorkspaceWidth,
      previewPan,
      previewWorkspaceSize,
      previewZoom,
      selectedMeta,
      shortformFrameHeight,
      shortformFrameWidth,
    ]
  );

  const {
    applyPreviewZoom,
    resetPreviewView,
    centerPreviewView,
    setOneToOnePreviewView,
  } = usePreviewViewportCommands({
    previewViewportRef,
    previewBaseOffset: viewportValues.previewBaseOffset,
    previewSize: viewportValues.previewSize,
    previewZoom,
    previewPan,
    previewFitZoom: viewportValues.previewFitZoom,
    setPreviewZoom,
    setPreviewPan,
  });

  const {
    handlePreviewViewportWheel,
    handlePreviewViewportMouseDownCapture,
  } = usePreviewPanInteractions({
    previewZoom,
    previewPan,
    previewPanDragRef,
    previewPanModifierRef,
    setPreviewPan,
    setIsPreviewPanning,
    setIsPreviewPanModifierActive,
    applyPreviewZoom,
  });

  usePreviewWorkspaceResize({
    previewWorkspaceRef,
    setPreviewWorkspaceSize,
  });

  const applyInitialPreviewView = useEffectEvent(() => {
    setPreviewZoom(viewportValues.previewFitZoom);
    setPreviewPan(
      getCenteredPreviewPan(
        viewportValues.previewSize.width,
        viewportValues.previewSize.height,
        viewportValues.previewFitZoom
      )
    );
  });

  useEffect(() => {
    pendingInitialPreviewViewRef.current = true;
  }, [
    selectedCompId,
    selectedMeta?.height,
    selectedMeta?.width,
  ]);

  useEffect(() => {
    if (!pendingInitialPreviewViewRef.current || !selectedMeta) {
      return;
    }

    if (previewWorkspaceSize.width <= 0 || previewWorkspaceSize.height <= 0) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      applyInitialPreviewView();
      pendingInitialPreviewViewRef.current = false;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    previewWorkspaceSize.height,
    previewWorkspaceSize.width,
    selectedMeta,
  ]);

  return {
    previewViewportRef,
    previewWorkspaceRef,
    ...viewportValues,
    resetPreviewView,
    centerPreviewView,
    setOneToOnePreviewView,
    handlePreviewViewportWheel,
    handlePreviewViewportMouseDownCapture,
  };
}
