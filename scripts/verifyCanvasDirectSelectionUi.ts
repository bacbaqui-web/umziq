import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backdropSource = readFileSync(
  new URL(
    "../src/features/preview/components/PreviewGizmoBackdrop.tsx",
    import.meta.url,
  ),
  "utf8",
);
const handlesSource = readFileSync(
  new URL(
    "../src/features/preview/components/PreviewGizmoHandles.tsx",
    import.meta.url,
  ),
  "utf8",
);
const connectionHitSource = readFileSync(
  new URL(
    "../src/features/preview/components/PreviewGizmoConnectionHitLayer.tsx",
    import.meta.url,
  ),
  "utf8",
);
const activeGizmoSource = readFileSync(
  new URL(
    "../src/features/preview/components/PreviewGizmoActiveLayer.tsx",
    import.meta.url,
  ),
  "utf8",
);
const gizmoControlsSource = readFileSync(
  new URL(
    "../src/features/preview/components/PreviewGizmoControls.tsx",
    import.meta.url,
  ),
  "utf8",
);
const previewOverlaySource = readFileSync(
  new URL(
    "../src/features/preview/components/PreviewOverlay.tsx",
    import.meta.url,
  ),
  "utf8",
);
const workspaceSource = readFileSync(
  new URL(
    "../src/features/preview/components/PreviewWorkspacePane.tsx",
    import.meta.url,
  ),
  "utf8",
);
const controlsSource = readFileSync(
  new URL(
    "../src/features/preview/components/PreviewWorkspaceControls.tsx",
    import.meta.url,
  ),
  "utf8",
);
const editorCanvasStateSource = readFileSync(
  new URL("../src/editor/state/useEditorEngineStateStores.ts", import.meta.url),
  "utf8",
);
const scaleControllerSource = readFileSync(
  new URL(
    "../src/engines/canvas/controllers/useCanvasScaleDragController.ts",
    import.meta.url,
  ),
  "utf8",
);
const gizmoControllerSource = readFileSync(
  new URL(
    "../src/engines/canvas/controllers/useCanvasGizmoController.ts",
    import.meta.url,
  ),
  "utf8",
);
const pointerControllerSource = readFileSync(
  new URL(
    "../src/engines/canvas/controllers/useCanvasPointerController.ts",
    import.meta.url,
  ),
  "utf8",
);
const anchorSource = readFileSync(
  new URL(
    "../src/features/preview/components/PreviewAnchorControl.tsx",
    import.meta.url,
  ),
  "utf8",
);
const motionPathSource = readFileSync(
  new URL(
    "../src/features/preview/components/PreviewMotionPathLayer.tsx",
    import.meta.url,
  ),
  "utf8",
);

assert.equal(backdropSource.includes("<polygon"), false);
assert.equal(backdropSource.includes("previewCorners"), false);
assert.equal(backdropSource.includes('pointerEvents: "auto"'), false);
assert.equal(backdropSource.includes("<polyline"), false);
assert.equal(backdropSource.includes("data-scale-arrow={handle.key}"), true);
assert.equal(backdropSource.includes("const path = ["), true);
assert.equal(backdropSource.includes("d={path}"), true);
assert.equal(
  backdropSource.includes("`M ${handle.lineStart.x} ${handle.lineStart.y}`"),
  true,
);
assert.equal(
  backdropSource.includes("`M ${previewAnchor.x} ${previewAnchor.y}`"),
  false,
);
assert.equal(backdropSource.includes("<g key={`arrow-${handle.key}`}>"), false);
assert.equal(backdropSource.includes("x2={handle.point.x}"), false);
assert.equal(backdropSource.includes("handle.arrowWingPoints.first"), true);
assert.equal(
  backdropSource.match(/`L \$\{handle\.point\.x\} \$\{handle\.point\.y\}`/g)
    ?.length,
  1,
);
assert.equal(
  backdropSource.match(/`M \$\{handle\.point\.x\} \$\{handle\.point\.y\}`/g)
    ?.length,
  1,
);
assert.equal(handlesSource.includes("clipPath"), false);
assert.equal(handlesSource.includes("<span"), false);
assert.equal(handlesSource.includes("const RADIAL_ENDPOINT_SIZE = 10;"), true);
assert.equal(handlesSource.includes("const size = 40;"), true);
assert.equal(anchorSource.includes("width: 10"), true);
assert.equal(anchorSource.includes("height: 10"), true);
assert.equal(workspaceSource.includes("interactionCommands.pressTarget"), true);
assert.equal(workspaceSource.includes("event.detail >= 2"), true);
assert.equal(workspaceSource.includes("directSelectionHover.moveTarget"), true);
assert.equal(
  workspaceSource.includes("directSelectionHover.doubleClickTarget"),
  true,
);
assert.equal(
  workspaceSource.includes("isCanvasTransformDragActive(interactionViewModel)"),
  true,
);
assert.equal(
  workspaceSource.includes("shouldRunCanvasDirectSelectionHover"),
  true,
);
assert.equal(
  workspaceSource.includes(".preview-toolbar,button,input,select,textarea"),
  true,
);
assert.equal(controlsSource.includes("선택 강조"), true);
assert.equal(controlsSource.includes("aria-pressed={showSelectionGlow}"), true);
assert.equal(
  editorCanvasStateSource.includes(
    "useState(true);\n  const [isDraggingAnchor",
  ),
  true,
);
assert.equal(
  scaleControllerSource.match(/setIsDraggingScale\(true\)/g)?.length,
  1,
);
assert.equal(
  scaleControllerSource.match(/setIsDraggingScale\(false\)/g)?.length,
  2,
);
assert.equal(gizmoControllerSource.includes("state.isDraggingScale ||"), true);
assert.equal(
  gizmoControllerSource.includes(
    "pending.handle,\n          pending.startClientX,\n          pending.startClientY",
  ),
  true,
);
assert.equal(anchorSource.includes("onDoubleClick"), true);
assert.equal(motionPathSource.includes("onDoubleClick"), true);
assert.equal(
  activeGizmoSource.includes("<PreviewGizmoConnectionHitLayer"),
  true,
);
const gizmoHandlesRenderIndex = gizmoControlsSource.indexOf(
  "<PreviewGizmoHandles",
);
const gizmoAnchorRenderIndex = gizmoControlsSource.indexOf(
  "<PreviewAnchorControl",
);
const gizmoReadoutsRenderIndex = gizmoControlsSource.indexOf(
  "<PreviewGizmoReadouts",
);
assert.notEqual(gizmoHandlesRenderIndex, -1);
assert.notEqual(gizmoAnchorRenderIndex, -1);
assert.notEqual(gizmoReadoutsRenderIndex, -1);
assert.equal(gizmoHandlesRenderIndex < gizmoReadoutsRenderIndex, true);
assert.equal(gizmoAnchorRenderIndex < gizmoReadoutsRenderIndex, true);
assert.equal(
  connectionHitSource.includes("CONNECTION_HIT_STROKE_WIDTH = 12"),
  true,
);
assert.equal(connectionHitSource.includes('stroke="transparent"'), true);
assert.equal(connectionHitSource.includes('pointerEvents="stroke"'), true);
assert.equal(connectionHitSource.includes('strokeLinecap="butt"'), true);
assert.equal(connectionHitSource.includes("onHoverHandle(hoverHandle)"), true);
assert.equal(
  connectionHitSource.includes("onPress(event.clientX, event.clientY)"),
  true,
);
assert.equal(connectionHitSource.includes("onOpenInput()"), true);
assert.equal(connectionHitSource.includes("cursors.scale[handle.key]"), true);
assert.equal(connectionHitSource.includes("cursors.rotation"), true);
assert.equal(connectionHitSource.includes("cursors.opacity"), true);
assert.equal(
  connectionHitSource.includes(
    "Math.hypot(end.x - start.x, end.y - start.y) < 0.001",
  ),
  true,
);
assert.equal(connectionHitSource.includes("start={handle.lineStart}"), true);
assert.equal(connectionHitSource.includes("end={handle.point}"), true);
assert.equal(
  connectionHitSource.includes("end={previewRotationHandle.lineEnd}"),
  true,
);
assert.equal(
  connectionHitSource.includes("end={previewOpacityHandle.lineEnd}"),
  true,
);
assert.equal(
  previewOverlaySource.includes("viewModel.isDraggingAnchor ||"),
  true,
);
assert.equal(
  previewOverlaySource.includes("viewModel.isDraggingPosition ||"),
  true,
);
assert.equal(
  previewOverlaySource.includes("viewModel.isDraggingScale ||"),
  true,
);
assert.equal(
  previewOverlaySource.includes("viewModel.isDraggingRotation ||"),
  true,
);
assert.equal(
  previewOverlaySource.includes("viewModel.isDraggingOpacity"),
  true,
);
assert.equal(
  previewOverlaySource.includes("isTransformHandleDragging &&"),
  true,
);
assert.equal(previewOverlaySource.includes("createPortal("), true);
assert.equal(previewOverlaySource.includes("document.body"), true);
assert.equal(
  previewOverlaySource.includes(
    'data-canvas-transform-drag-cursor-shield="active"',
  ),
  true,
);
assert.equal(previewOverlaySource.includes('position: "fixed"'), true);
assert.equal(previewOverlaySource.includes("inset: 0"), true);
assert.equal(previewOverlaySource.includes("zIndex: 2147483647"), true);
assert.equal(previewOverlaySource.includes('cursor: "none"'), true);
assert.equal(previewOverlaySource.includes('pointerEvents: "auto"'), true);
assert.equal(
  previewOverlaySource.includes('document.createElement("style")'),
  false,
);
assert.equal(previewOverlaySource.includes("pendingHandleInteraction"), false);
assert.equal(
  pointerControllerSource.includes(
    'const handleMouseUp = () => finish("commit")',
  ),
  true,
);
assert.equal(
  pointerControllerSource.includes(
    'const handleCancel = () => finish("cancel")',
  ),
  true,
);
assert.equal(
  pointerControllerSource.includes(
    'window.addEventListener("mousemove", handleMouseMove)',
  ),
  true,
);
assert.equal(
  pointerControllerSource.includes(
    'window.addEventListener("mouseup", handleMouseUp)',
  ),
  true,
);
assert.equal(
  pointerControllerSource.includes(
    'window.addEventListener("blur", handleCancel)',
  ),
  true,
);
assert.equal(
  pointerControllerSource.includes(
    'window.removeEventListener("mousemove", handleMouseMove)',
  ),
  true,
);
assert.equal(
  pointerControllerSource.includes(
    'window.removeEventListener("mouseup", handleMouseUp)',
  ),
  true,
);
assert.equal(
  pointerControllerSource.includes(
    'window.removeEventListener("blur", handleCancel)',
  ),
  true,
);
assert.equal(
  pointerControllerSource.includes(
    'document.addEventListener("visibilitychange", handleVisibilityChange)',
  ),
  true,
);
assert.equal(
  pointerControllerSource.includes(
    'document.removeEventListener("visibilitychange", handleVisibilityChange)',
  ),
  true,
);
assert.equal(pointerControllerSource.includes("scheduler.dispose()"), true);

console.log("Canvas direct selection UI verification passed");
