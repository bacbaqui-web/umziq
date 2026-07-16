import { useCallback, useEffect, useEffectEvent, type RefObject } from "react";
import {
  evaluateCompositionPosition,
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerPosition,
  evaluateLayerRotation,
  evaluateLayerScale,
  getTransformEditMode,
  type TransformEditMode,
  type TransformTargetSelection,
} from "@/engines/animation";
import type { Composition, CompositionMeta, Layer, Position, PropertyTrackState, Scale } from "@/models";
import type { PreviewOverlay, ScaleHandleDirection } from "@/engines/canvas/models/canvasViewModel";
import type {
  CanvasInteractionStatePort,
  CanvasPointerController,
} from "@/engines/canvas/models/canvasInteractionModel";
import {
  calculateOpacityDragUpdate,
  calculatePreviewPositionDragUpdate,
  calculateRotationDragUpdate,
  calculateScaleDragUpdate,
  formatPositionDeltaReadout,
  formatRotationHandleValue,
  formatScaleHandleReadout,
} from "@/engines/canvas/helpers/canvasInteractionHelpers";
import {
  createPreviewPositionDragState,
  createPreviewRotationDragState,
  resolvePreviewPointer,
  type PreviewPointerContext,
} from "@/engines/canvas/helpers/canvasPointerHelpers";
import {
  getCompensatedTransformOffset,
  resolveAnchorFromWorldPoint,
} from "@/engines/canvas/helpers/canvasCoordinateHelpers";

type CanvasHistoryPort = {
  push: () => void;
  begin: () => void;
  markDirty: () => void;
  commit: () => void;
  cancel: () => void;
};

type CanvasTransformCommandPort = {
  applyPosition: (value: Position, mode: TransformEditMode) => void;
  applyScale: (value: Scale, mode: TransformEditMode) => void;
  applyRotation: (value: number, mode: TransformEditMode) => void;
  applyOpacity: (value: number, mode: TransformEditMode) => void;
  applyAnchor: (command: {
    target: { kind: "layer" | "composition"; id: string };
    anchor: Position;
    transformOffset: Position;
  }) => void;
};

export type UseCanvasTransformControllerOptions = {
  masterCompId: string;
  overlayRef: RefObject<HTMLDivElement | null>;
  selectedMeta: CompositionMeta | null;
  previewSize: { width: number; height: number };
  previewZoom: number;
  previewViewportOffset: Position;
  selectedOverlay: PreviewOverlay;
  selectedTarget: TransformTargetSelection;
  selectedTimelineTargetItem: { startFrame: number } | null;
  selectedTransformLocalFrame: number;
  selectedPropertyState: PropertyTrackState;
  playheadFrame: number;
  resolvedPosition: Position;
  resolvedOpacity: number;
  allLayersById: ReadonlyMap<string, Layer>;
  allCompositionsById: ReadonlyMap<string, Composition>;
  metaByCompId: Readonly<Record<string, CompositionMeta>>;
  drafts: {
    setPosition: (value: Position | null) => void;
    setScale: (value: Scale | null) => void;
    setRotation: (value: number | null) => void;
    setOpacity: (value: number | null) => void;
  };
  state: CanvasInteractionStatePort;
  history: CanvasHistoryPort;
  commands: CanvasTransformCommandPort;
  pointer: CanvasPointerController;
};

export function useCanvasTransformController(
  options: UseCanvasTransformControllerOptions
) {
  const getPointerContext = useCallback(
    (clientX: number, clientY: number): PreviewPointerContext | null => {
      const bounds = options.overlayRef.current?.getBoundingClientRect();
      if (!bounds || !options.selectedMeta) return null;
      return {
        overlayBounds: bounds,
        selectedMeta: options.selectedMeta,
        previewSize: options.previewSize,
        previewZoom: options.previewZoom,
        previewViewportOffset: options.previewViewportOffset,
        clientX,
        clientY,
      };
    },
    [
      options.overlayRef,
      options.previewSize,
      options.previewViewportOffset,
      options.previewZoom,
      options.selectedMeta,
    ]
  );

  const startPositionDrag = useCallback(
    (clientX: number, clientY: number) => {
      const context = getPointerContext(clientX, clientY);
      if (!context || !options.selectedOverlay) return;
      const localFrame = options.selectedTimelineTargetItem
        ? Math.max(0, options.playheadFrame - options.selectedTimelineTargetItem.startFrame)
        : options.playheadFrame;
      const startPosition =
        options.selectedTarget?.kind === "layer"
          ? evaluateLayerPosition(options.selectedTarget.layer, localFrame)
          : options.selectedTarget?.kind === "composition"
            ? evaluateCompositionPosition(options.selectedTarget.composition, localFrame)
            : options.resolvedPosition;
      const drag = createPreviewPositionDragState(
        context,
        options.selectedOverlay,
        startPosition
      );
      const mode = getTransformEditMode(options.selectedPropertyState.position);
      options.history.begin();
      options.state.setIsDraggingPosition(true);
      options.state.setPositionHandleReadout(formatPositionDeltaReadout({ x: 0, y: 0 }));
      options.pointer.start({
        onMove: (sample) => {
          const nextContext = getPointerContext(sample.clientX, sample.clientY);
          if (!nextContext) return;
          const result = calculatePreviewPositionDragUpdate(nextContext, drag);
          options.drafts.setPosition(result.nextPosition);
          options.state.setPositionHandleReadout(result.readout);
          options.history.markDirty();
          options.commands.applyPosition(result.nextPosition, mode);
        },
        onCommit: () => {
          options.state.setIsDraggingPosition(false);
          options.state.setPositionHandleReadout(null);
          options.history.commit();
        },
        onCancel: () => {
          options.state.setIsDraggingPosition(false);
          options.state.setPositionHandleReadout(null);
          options.history.cancel();
        },
      });
    },
    [getPointerContext, options]
  );

  const startScaleDrag = useCallback(
    (handle: ScaleHandleDirection) => {
      if (!options.selectedOverlay) return;
      const drag = {
        overlay: options.selectedOverlay,
        handle,
        initialScale: {
          x: options.selectedOverlay.scaleX,
          y: options.selectedOverlay.scaleY,
        },
      };
      const mode = getTransformEditMode(options.selectedPropertyState.scale);
      options.history.begin();
      options.state.setScaleHandleReadout({
        handle,
        text: formatScaleHandleReadout(handle, drag.initialScale),
      });
      options.pointer.start({
        onMove: (sample) => {
          const context = getPointerContext(sample.clientX, sample.clientY);
          if (!context) return;
          const result = calculateScaleDragUpdate(context, drag, sample.shiftKey);
          if (!result) return;
          options.drafts.setScale(result.nextScale);
          options.state.setScaleHandleReadout({ handle, text: result.readout });
          options.history.markDirty();
          options.commands.applyScale(result.nextScale, mode);
        },
        onCommit: () => {
          options.state.setScaleHandleReadout(null);
          options.history.commit();
        },
        onCancel: () => {
          options.state.setScaleHandleReadout(null);
          options.history.cancel();
        },
      });
    },
    [getPointerContext, options]
  );

  const startRotationDrag = useCallback(
    (clientX: number, clientY: number) => {
      const context = getPointerContext(clientX, clientY);
      if (!context || !options.selectedOverlay) return;
      const drag = createPreviewRotationDragState(context, options.selectedOverlay);
      const mode = getTransformEditMode(options.selectedPropertyState.rotation);
      options.history.begin();
      options.state.setIsDraggingRotation(true);
      options.state.setRotationHandleReadout(
        formatRotationHandleValue(options.selectedOverlay.rotation)
      );
      options.pointer.start({
        onMove: (sample) => {
          const nextContext = getPointerContext(sample.clientX, sample.clientY);
          if (!nextContext) return;
          const result = calculateRotationDragUpdate(nextContext, drag, sample.shiftKey);
          if (!result) return;
          options.drafts.setRotation(result.nextRotation);
          options.state.setRotationHandleReadout(result.readout);
          options.history.markDirty();
          options.commands.applyRotation(result.nextRotation, mode);
        },
        onCommit: () => {
          options.state.setIsDraggingRotation(false);
          options.state.setRotationHandleReadout(null);
          options.history.commit();
        },
        onCancel: () => {
          options.state.setIsDraggingRotation(false);
          options.state.setRotationHandleReadout(null);
          options.history.cancel();
        },
      });
    },
    [getPointerContext, options]
  );

  const startOpacityDrag = useCallback(() => {
    if (!options.selectedOverlay) return;
    const overlay = options.selectedOverlay;
    const mode = getTransformEditMode(options.selectedPropertyState.opacity);
    options.history.begin();
    options.state.setIsDraggingOpacity(true);
    options.state.setOpacityHandleReadout(`${Math.round(options.resolvedOpacity)}%`);
    options.pointer.start({
      onMove: (sample) => {
        const context = getPointerContext(sample.clientX, sample.clientY);
        if (!context) return;
        const result = calculateOpacityDragUpdate(context, overlay, sample.shiftKey);
        options.drafts.setOpacity(result.nextOpacity);
        options.state.setOpacityHandleReadout(result.readout);
        options.history.markDirty();
        options.commands.applyOpacity(result.nextOpacity, mode);
      },
      onCommit: () => {
        options.state.setIsDraggingOpacity(false);
        options.state.setOpacityHandleReadout(null);
        options.history.commit();
      },
      onCancel: () => {
        options.state.setIsDraggingOpacity(false);
        options.state.setOpacityHandleReadout(null);
        options.history.cancel();
      },
    });
  }, [getPointerContext, options]);

  const startAnchorDrag = useCallback(() => {
    const overlay = options.selectedOverlay;
    if (!overlay) return;
    options.history.begin();
    options.state.setIsDraggingAnchor(true);
    options.pointer.start({
      onMove: (sample) => {
        const context = getPointerContext(sample.clientX, sample.clientY);
        if (!context) return;
        const pointer = resolvePreviewPointer(context);
        if (overlay.targetKind === "layer") {
          const layer = options.allLayersById.get(overlay.targetId);
          if (!layer) return;
          const scale = evaluateLayerScale(layer, options.selectedTransformLocalFrame);
          const rotation = evaluateLayerRotation(layer, options.selectedTransformLocalFrame);
          const position = evaluateLayerPosition(layer, options.playheadFrame);
          const anchor = resolveAnchorFromWorldPoint(
            pointer,
            position,
            layer.transformOffset,
            layer.anchor,
            scale,
            rotation,
            overlay.sourceWidth,
            overlay.sourceHeight
          );
          options.commands.applyAnchor({
            target: { kind: "layer", id: overlay.targetId },
            anchor,
            transformOffset: getCompensatedTransformOffset(
              layer.transformOffset,
              layer.anchor,
              anchor,
              scale,
              rotation
            ),
          });
          options.history.markDirty();
          return;
        }
        if (overlay.targetId === options.masterCompId) return;
        const composition = options.allCompositionsById.get(overlay.targetId);
        if (!composition) return;
        const meta = options.metaByCompId[composition.id] ?? options.selectedMeta;
        if (!meta) return;
        const scale = evaluateCompositionScale(
          composition,
          options.selectedTransformLocalFrame
        );
        const rotation = evaluateCompositionRotation(
          composition,
          options.selectedTransformLocalFrame
        );
        const position = evaluateCompositionPosition(
          composition,
          options.selectedTransformLocalFrame
        );
        const anchor = resolveAnchorFromWorldPoint(
          pointer,
          position,
          composition.transformOffset,
          composition.anchor,
          scale,
          rotation,
          meta.width,
          meta.height
        );
        options.commands.applyAnchor({
          target: { kind: "composition", id: overlay.targetId },
          anchor,
          transformOffset: getCompensatedTransformOffset(
            composition.transformOffset,
            composition.anchor,
            anchor,
            scale,
            rotation
          ),
        });
        options.history.markDirty();
      },
      onCommit: () => {
        options.state.setIsDraggingAnchor(false);
        options.history.commit();
      },
      onCancel: () => {
        options.state.setIsDraggingAnchor(false);
        options.history.cancel();
      },
    });
  }, [getPointerContext, options]);

  const handleArrowNudge = useEffectEvent((event: KeyboardEvent) => {
    if (!options.selectedTarget) return;
    const target = event.target as HTMLElement | null;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable
    ) return;
    const step = event.shiftKey ? 10 : 1;
    const delta =
      event.key === "ArrowLeft" ? { x: -step, y: 0 }
        : event.key === "ArrowRight" ? { x: step, y: 0 }
          : event.key === "ArrowUp" ? { x: 0, y: -step }
            : event.key === "ArrowDown" ? { x: 0, y: step }
              : null;
    if (!delta) return;
    event.preventDefault();
    options.history.push();
    const next = {
      x: options.resolvedPosition.x + delta.x,
      y: options.resolvedPosition.y + delta.y,
    };
    options.drafts.setPosition(next);
    options.commands.applyPosition(
      next,
      getTransformEditMode(options.selectedPropertyState.position)
    );
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleArrowNudge(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return {
    startPositionDrag,
    startScaleDrag,
    startRotationDrag,
    startOpacityDrag,
    startAnchorDrag,
  };
}
