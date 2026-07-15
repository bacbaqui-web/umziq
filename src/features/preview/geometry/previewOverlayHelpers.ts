import type { PreviewOverlay as PreviewOverlayData, ScaleHandleDirection } from "@/editor/types/editorViewTypes";

export type GizmoHandleDescriptor = {
  key: ScaleHandleDirection;
  x: number;
  y: number;
  lineStartX: number;
  lineStartY: number;
  borderColor: string;
  background: string;
  label: string;
  shape: "square" | "diamond";
};

export type SimpleGizmoHandleDescriptor = {
  x: number;
  y: number;
  lineStartX: number;
  lineStartY: number;
};

const OPACITY_MIN_RADIUS = 140;
const OPACITY_MAX_RADIUS = 540;

function normalizeVector(x: number, y: number) {
  const length = Math.hypot(x, y) || 1;

  return {
    x: x / length,
    y: y / length,
  };
}

export function getScaleHandleDescriptors(
  overlay: NonNullable<PreviewOverlayData>
): GizmoHandleDescriptor[] {
  const localXAxis = normalizeVector(
    overlay.corners.ne.x - overlay.corners.nw.x,
    overlay.corners.ne.y - overlay.corners.nw.y
  );
  const localYAxis = normalizeVector(
    overlay.corners.sw.x - overlay.corners.nw.x,
    overlay.corners.sw.y - overlay.corners.nw.y
  );
  const xAxis = {
    x: -localXAxis.x,
    y: -localXAxis.y,
  };
  const yAxis = {
    x: -localYAxis.x,
    y: -localYAxis.y,
  };
  const xyAxis = normalizeVector(localXAxis.x + localYAxis.x, localXAxis.y + localYAxis.y);
  const axisRadius = 410;
  const diagonalRadius = 540;

  return [
    {
      key: "x",
      x: overlay.anchorX + xAxis.x * axisRadius,
      y: overlay.anchorY + xAxis.y * axisRadius,
      lineStartX: overlay.anchorX,
      lineStartY: overlay.anchorY,
      borderColor: "rgba(255, 104, 104, 0.98)",
      background: "rgba(40, 16, 16, 0.94)",
      label: "X 스케일",
      shape: "square",
    },
    {
      key: "y",
      x: overlay.anchorX + yAxis.x * axisRadius,
      y: overlay.anchorY + yAxis.y * axisRadius,
      lineStartX: overlay.anchorX,
      lineStartY: overlay.anchorY,
      borderColor: "rgba(116, 231, 140, 0.98)",
      background: "rgba(14, 28, 18, 0.94)",
      label: "Y 스케일",
      shape: "square",
    },
    {
      key: "xy",
      x: overlay.anchorX + xyAxis.x * diagonalRadius,
      y: overlay.anchorY + xyAxis.y * diagonalRadius,
      lineStartX: overlay.anchorX,
      lineStartY: overlay.anchorY,
      borderColor: "rgba(255, 225, 115, 0.98)",
      background: "rgba(33, 28, 12, 0.94)",
      label: "XY 스케일",
      shape: "diamond",
    },
  ];
}

export function getScaleHandleCursor(handle: ScaleHandleDirection) {
  switch (handle) {
    case "x":
      return "ew-resize";
    case "y":
      return "ns-resize";
    case "xy":
      return "nwse-resize";
  }
}

function buildSvgCursor(svg: string, fallback: string) {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  return `url("data:image/svg+xml,${encoded}") 12 12, ${fallback}`;
}

export function getRotationHandleCursor() {
  return buildSvgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M16.8 8.4A6.5 6.5 0 1 0 18.2 13" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M17.8 5.6v4.2h-4.2" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16.8 8.4A6.5 6.5 0 1 0 18.2 13" stroke="#111111" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M17.8 5.6v4.2h-4.2" stroke="#111111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    "crosshair"
  );
}

export function getOpacityHandleCursor() {
  return buildSvgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 4.5c3.5 0 6.5 2.2 8 5.5-1.5 3.3-4.5 5.5-8 5.5S5.5 13.3 4 10c1.5-3.3 4.5-5.5 8-5.5Z" stroke="#ffffff" stroke-width="3.2"/>
      <circle cx="12" cy="10" r="3.6" fill="#ffffff"/>
      <path d="M12 4.5c3.5 0 6.5 2.2 8 5.5-1.5 3.3-4.5 5.5-8 5.5S5.5 13.3 4 10c1.5-3.3 4.5-5.5 8-5.5Z" stroke="#111111" stroke-width="1.6"/>
      <circle cx="12" cy="10" r="2.4" fill="#111111"/>
    </svg>`,
    "pointer"
  );
}

export function getMoveHandleCursor() {
  return buildSvgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 4v16M4 12h16" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round"/>
      <path d="m12 4 2.6 2.6M12 4 9.4 6.6M20 12l-2.6 2.6M20 12l-2.6-2.6M12 20l2.6-2.6M12 20l-2.6-2.6M4 12l2.6 2.6M4 12l2.6-2.6" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 4v16M4 12h16" stroke="#111111" stroke-width="1.8" stroke-linecap="round"/>
      <path d="m12 4 2.6 2.6M12 4 9.4 6.6M20 12l-2.6 2.6M20 12l-2.6-2.6M12 20l2.6-2.6M12 20l-2.6-2.6M4 12l2.6 2.6M4 12l2.6-2.6" stroke="#111111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    "move"
  );
}

export function getRotationHandleDescriptor(
  overlay: NonNullable<PreviewOverlayData>
): SimpleGizmoHandleDescriptor {
  const localXAxis = normalizeVector(
    overlay.corners.ne.x - overlay.corners.nw.x,
    overlay.corners.ne.y - overlay.corners.nw.y
  );
  const localYAxis = normalizeVector(
    overlay.corners.sw.x - overlay.corners.nw.x,
    overlay.corners.sw.y - overlay.corners.nw.y
  );
  const handleDirection = normalizeVector(
    localXAxis.x - localYAxis.x,
    localXAxis.y - localYAxis.y
  );
  const innerRadius = 120;
  const outerRadius = 700;

  return {
    x: overlay.anchorX + handleDirection.x * outerRadius,
    y: overlay.anchorY + handleDirection.y * outerRadius,
    lineStartX: overlay.anchorX + handleDirection.x * innerRadius,
    lineStartY: overlay.anchorY + handleDirection.y * innerRadius,
  };
}

export function getMoveHandleDescriptor(
  overlay: NonNullable<PreviewOverlayData>
): SimpleGizmoHandleDescriptor {
  const localXAxis = normalizeVector(
    overlay.corners.ne.x - overlay.corners.nw.x,
    overlay.corners.ne.y - overlay.corners.nw.y
  );
  const innerRadius = 120;
  const outerRadius = 420;

  return {
    x: overlay.anchorX + localXAxis.x * outerRadius,
    y: overlay.anchorY + localXAxis.y * outerRadius,
    lineStartX: overlay.anchorX + localXAxis.x * innerRadius,
    lineStartY: overlay.anchorY + localXAxis.y * innerRadius,
  };
}

export function getOpacityHandleDescriptor(
  overlay: NonNullable<PreviewOverlayData>,
  opacity = 100
): SimpleGizmoHandleDescriptor {
  const localXAxis = normalizeVector(
    overlay.corners.ne.x - overlay.corners.nw.x,
    overlay.corners.ne.y - overlay.corners.nw.y
  );
  const localYAxis = normalizeVector(
    overlay.corners.sw.x - overlay.corners.nw.x,
    overlay.corners.sw.y - overlay.corners.nw.y
  );
  const handleDirection = normalizeVector(
    -localXAxis.x + localYAxis.x,
    -localXAxis.y + localYAxis.y
  );
  const clampedOpacity = Math.min(100, Math.max(0, opacity));
  const outerRadius =
    OPACITY_MIN_RADIUS + ((OPACITY_MAX_RADIUS - OPACITY_MIN_RADIUS) * clampedOpacity) / 100;
  const innerRadius = Math.min(outerRadius - 24, 52);

  return {
    x: overlay.anchorX + handleDirection.x * outerRadius,
    y: overlay.anchorY + handleDirection.y * outerRadius,
    lineStartX: overlay.anchorX + handleDirection.x * innerRadius,
    lineStartY: overlay.anchorY + handleDirection.y * innerRadius,
  };
}

export function getOpacityRadiusRange() {
  return {
    minRadius: OPACITY_MIN_RADIUS,
    maxRadius: OPACITY_MAX_RADIUS,
  };
}
