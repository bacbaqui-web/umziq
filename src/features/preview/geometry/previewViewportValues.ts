import { buildPreviewGuideGeometry } from "@/editor/preview/guideGeometry";
import { clampPreviewZoom } from "@/editor/preview/previewCamera";
import type { CompositionMeta, Position } from "@/editor/types/types";

type GetPreviewViewportValuesOptions = {
  previewMinWorkspaceWidth: number;
  previewMinWorkspaceHeight: number;
  previewWorkspaceSize: {
    width: number;
    height: number;
  };
  selectedMeta: CompositionMeta | null;
  shortformFrameWidth: number;
  shortformFrameHeight: number;
  previewZoom: number;
  previewPan: Position;
};

export function getPreviewViewportValues({
  previewMinWorkspaceWidth,
  previewMinWorkspaceHeight,
  previewWorkspaceSize,
  selectedMeta,
  shortformFrameWidth,
  shortformFrameHeight,
  previewZoom,
  previewPan,
}: GetPreviewViewportValuesOptions) {
  const previewViewportWidth = Math.max(
    previewMinWorkspaceWidth,
    Math.floor(previewWorkspaceSize.width)
  );
  const previewViewportHeight = Math.max(
    previewMinWorkspaceHeight,
    Math.floor(previewWorkspaceSize.height)
  );
  const previewFitZoom = selectedMeta
    ? clampPreviewZoom(
        Math.min(
          previewViewportWidth / shortformFrameWidth,
          previewViewportHeight / shortformFrameHeight
        )
      )
    : 1;
  const previewSize = {
    width: selectedMeta?.width ?? previewViewportWidth,
    height: selectedMeta?.height ?? previewViewportHeight,
  };
  const previewBaseOffset = {
    x: (previewViewportWidth - previewSize.width) / 2,
    y: (previewViewportHeight - previewSize.height) / 2,
  };
  const previewViewportOffset = {
    x: previewBaseOffset.x + previewPan.x,
    y: previewBaseOffset.y + previewPan.y,
  };
  const previewZoomPercent = Math.round(previewZoom * 100);
  const guideGeometry = buildPreviewGuideGeometry(
    {
      width: previewSize.width,
      height: previewSize.height,
    },
    shortformFrameWidth,
    shortformFrameHeight
  );

  return {
    previewViewportWidth,
    previewViewportHeight,
    previewFitZoom,
    previewSize,
    previewBaseOffset,
    previewViewportOffset,
    previewZoomPercent,
    guideGeometry,
  };
}
