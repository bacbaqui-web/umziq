const SAFE_ZONE_REFERENCE = {
  frame: {
    left: 996,
    right: 3003,
    top: 216,
    bottom: 3784,
  },
  innerVertical: {
    left: 1094,
    right: 2905,
  },
  topGuideY: 695,
  rightBox: {
    x: 2675,
    top: 1765,
    bottom: 3784,
  },
  lowerLeftBox: {
    top: 2785,
    left: 1094,
    right: 2300,
    bottom: 3784,
  },
} as const;

const SAFE_ZONE_FRAME_WIDTH =
  SAFE_ZONE_REFERENCE.frame.right - SAFE_ZONE_REFERENCE.frame.left;
const SAFE_ZONE_FRAME_HEIGHT =
  SAFE_ZONE_REFERENCE.frame.bottom - SAFE_ZONE_REFERENCE.frame.top;

const CAMERA_DIM_WORLD_EXTENT = 1_000_000;

const SAFE_ZONE_RATIOS = {
  innerLeft:
    (SAFE_ZONE_REFERENCE.innerVertical.left - SAFE_ZONE_REFERENCE.frame.left) /
    SAFE_ZONE_FRAME_WIDTH,
  innerRight:
    (SAFE_ZONE_REFERENCE.innerVertical.right - SAFE_ZONE_REFERENCE.frame.left) /
    SAFE_ZONE_FRAME_WIDTH,
  topGuide:
    (SAFE_ZONE_REFERENCE.topGuideY - SAFE_ZONE_REFERENCE.frame.top) /
    SAFE_ZONE_FRAME_HEIGHT,
  rightBoxX:
    (SAFE_ZONE_REFERENCE.rightBox.x - SAFE_ZONE_REFERENCE.frame.left) /
    SAFE_ZONE_FRAME_WIDTH,
  rightBoxTop:
    (SAFE_ZONE_REFERENCE.rightBox.top - SAFE_ZONE_REFERENCE.frame.top) /
    SAFE_ZONE_FRAME_HEIGHT,
  lowerLeftTop:
    (SAFE_ZONE_REFERENCE.lowerLeftBox.top - SAFE_ZONE_REFERENCE.frame.top) /
    SAFE_ZONE_FRAME_HEIGHT,
  lowerLeftRight:
    (SAFE_ZONE_REFERENCE.lowerLeftBox.right - SAFE_ZONE_REFERENCE.frame.left) /
    SAFE_ZONE_FRAME_WIDTH,
} as const;

export type PreviewGuideLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type PreviewGuideGeometry = {
  frameRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  dimRects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  safeZoneLines: PreviewGuideLine[];
};

export function buildPreviewGuideGeometry(
  previewWorldSize: {
    width: number;
    height: number;
  },
  shortformFrameWidth: number,
  shortformFrameHeight: number
): PreviewGuideGeometry {
  const frameRect = {
    x: previewWorldSize.width / 2 - shortformFrameWidth / 2,
    y: previewWorldSize.height / 2 - shortformFrameHeight / 2,
    width: shortformFrameWidth,
    height: shortformFrameHeight,
  };
  const extent = Math.max(
    CAMERA_DIM_WORLD_EXTENT,
    previewWorldSize.width * 100,
    previewWorldSize.height * 100,
    frameRect.width * 100,
    frameRect.height * 100
  );
  const frameRight = frameRect.x + frameRect.width;
  const frameBottom = frameRect.y + frameRect.height;
  const dimRects = [
    {
      x: -extent,
      y: -extent,
      width: extent * 2,
      height: frameRect.y + extent,
    },
    {
      x: -extent,
      y: frameBottom,
      width: extent * 2,
      height: extent - frameBottom,
    },
    {
      x: -extent,
      y: frameRect.y,
      width: frameRect.x + extent,
      height: frameRect.height,
    },
    {
      x: frameRight,
      y: frameRect.y,
      width: extent - frameRight,
      height: frameRect.height,
    },
  ].filter((rect) => rect.width > 0 && rect.height > 0);
  const safeZone = {
    frameLeftX: frameRect.x,
    frameRightX: frameRect.x + frameRect.width,
    frameTopY: frameRect.y,
    frameBottomY: frameRect.y + frameRect.height,
    innerLeftX: frameRect.x + frameRect.width * SAFE_ZONE_RATIOS.innerLeft,
    innerRightX: frameRect.x + frameRect.width * SAFE_ZONE_RATIOS.innerRight,
    topGuideY: frameRect.y + frameRect.height * SAFE_ZONE_RATIOS.topGuide,
    rightBoxX: frameRect.x + frameRect.width * SAFE_ZONE_RATIOS.rightBoxX,
    rightBoxTopY: frameRect.y + frameRect.height * SAFE_ZONE_RATIOS.rightBoxTop,
    lowerLeftTopY: frameRect.y + frameRect.height * SAFE_ZONE_RATIOS.lowerLeftTop,
    lowerLeftRightX: frameRect.x + frameRect.width * SAFE_ZONE_RATIOS.lowerLeftRight,
  };

  return {
    frameRect,
    dimRects,
    safeZoneLines: [
      {
        x1: safeZone.frameLeftX,
        y1: safeZone.frameTopY,
        x2: safeZone.frameRightX,
        y2: safeZone.frameTopY,
      },
      {
        x1: safeZone.frameRightX,
        y1: safeZone.frameTopY,
        x2: safeZone.frameRightX,
        y2: safeZone.frameBottomY,
      },
      {
        x1: safeZone.frameLeftX,
        y1: safeZone.frameBottomY,
        x2: safeZone.frameRightX,
        y2: safeZone.frameBottomY,
      },
      {
        x1: safeZone.frameLeftX,
        y1: safeZone.frameTopY,
        x2: safeZone.frameLeftX,
        y2: safeZone.frameBottomY,
      },
      {
        x1: safeZone.innerRightX,
        y1: safeZone.frameTopY,
        x2: safeZone.innerRightX,
        y2: safeZone.frameBottomY,
      },
      {
        x1: safeZone.innerLeftX,
        y1: safeZone.frameTopY,
        x2: safeZone.innerLeftX,
        y2: safeZone.frameBottomY,
      },
      {
        x1: safeZone.innerLeftX,
        y1: safeZone.topGuideY,
        x2: safeZone.innerRightX,
        y2: safeZone.topGuideY,
      },
      {
        x1: safeZone.innerLeftX,
        y1: safeZone.lowerLeftTopY,
        x2: safeZone.lowerLeftRightX,
        y2: safeZone.lowerLeftTopY,
      },
      {
        x1: safeZone.lowerLeftRightX,
        y1: safeZone.lowerLeftTopY,
        x2: safeZone.lowerLeftRightX,
        y2: safeZone.frameBottomY,
      },
      {
        x1: safeZone.rightBoxX,
        y1: safeZone.rightBoxTopY,
        x2: safeZone.innerRightX,
        y2: safeZone.rightBoxTopY,
      },
      {
        x1: safeZone.rightBoxX,
        y1: safeZone.rightBoxTopY,
        x2: safeZone.rightBoxX,
        y2: safeZone.frameBottomY,
      },
    ],
  };
}

export function buildCanvasGuideViewModel({
  previewSize,
  shortformFrameWidth,
  shortformFrameHeight,
  zoom,
  showShortformFrame,
  showSafeZoneGuides,
  cameraScalePercent,
  cameraDimOpacityPercent,
}: {
  previewSize: { width: number; height: number };
  shortformFrameWidth: number;
  shortformFrameHeight: number;
  zoom: number;
  showShortformFrame: boolean;
  showSafeZoneGuides: boolean;
  cameraScalePercent: number;
  cameraDimOpacityPercent: number;
}) {
  const cameraScale = Math.max(1, cameraScalePercent) / 100;
  return {
    previewSize,
    geometry: buildPreviewGuideGeometry(
      previewSize,
      shortformFrameWidth * cameraScale,
      shortformFrameHeight * cameraScale
    ),
    showShortformFrame,
    showSafeZoneGuides,
    safeZoneStrokeWidth: 1 / Math.max(zoom, 0.0001),
    cameraScalePercent,
    cameraDimOpacityPercent: Math.min(
      100,
      Math.max(0, cameraDimOpacityPercent)
    ),
  };
}
