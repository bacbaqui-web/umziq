import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import type { DrawingLayerDocument, PlainDataObject } from "@/models";
import { fillDrawingRegion, createDrawingStroke } from "@/engines/drawing/helpers/drawingElementHelpers";
import type { DrawingEngineViewProps, DrawingTool } from "@/engines/drawing/models/drawingEngineModel";

function localPoint(event: PointerEvent<SVGSVGElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const viewBox = event.currentTarget.viewBox.baseVal;
  return {
    x: (event.clientX - rect.left) * viewBox.width / rect.width,
    y: (event.clientY - rect.top) * viewBox.height / rect.height,
  };
}

export function useDrawingEngine(options: {
  selected: DrawingLayerDocument | null;
  parentSize: { width: number; height: number };
  resetRevision: number;
  replaceElements: (layerDocumentId: string, elements: PlainDataObject[]) => boolean;
}): DrawingEngineViewProps {
  const [tool, setTool] = useState<DrawingTool>("brush");
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(12);
  const [draftPoints, setDraftPoints] = useState<readonly { x: number; y: number }[]>([]);
  const activePointerId = useRef<number | null>(null);
  const draftLayerDocumentId = useRef<string | null>(null);
  const operationRevision = useRef(0);
  const selectedLayerDocumentId = options.selected?.layerDocumentId ?? null;
  const selectionScope = `${options.resetRevision}:${selectedLayerDocumentId ?? "none"}`;
  const currentSelectionScope = useRef(selectionScope);
  const [modeState, setModeState] = useState({ scope: selectionScope, enabled: false });
  const modeEnabled = selectedLayerDocumentId !== null && modeState.scope === selectionScope && modeState.enabled;

  useLayoutEffect(() => {
    currentSelectionScope.current = selectionScope;
    activePointerId.current = null;
    draftLayerDocumentId.current = null;
    operationRevision.current += 1;
  }, [selectionScope]);

  const commit = (points: readonly { x: number; y: number }[]) => {
    const selected = options.selected;
    if (!selected || points.length === 0 || tool === "fill") return;
    options.replaceElements(selected.layerDocumentId, [
      ...selected.data.elements,
      createDrawingStroke({ tool, color, size, points }),
    ]);
  };
  return {
    canEnableMode: Boolean(options.selected), modeEnabled, tool, color, size, draftPoints,
    elements: options.selected?.data.elements ?? [],
    geometry: options.selected ? (() => {
      const raster = options.selected.data.elements.find((element) => element.kind === "raster");
      return {
        width: typeof raster?.width === "number" ? raster.width : options.parentSize.width,
        height: typeof raster?.height === "number" ? raster.height : options.parentSize.height,
        position: options.selected.common.transform.position,
        anchor: options.selected.common.transform.anchor,
        scale: options.selected.common.transform.scale,
        rotation: options.selected.common.transform.rotation,
      };
    })() : null,
    toggleMode: () => {
      if (!options.selected) return;
      activePointerId.current = null;
      draftLayerDocumentId.current = null;
      operationRevision.current += 1;
      setDraftPoints([]);
      setModeState({ scope: selectionScope, enabled: !modeEnabled });
    },
    setTool, setColor,
    setSize: (value) => setSize(Math.min(200, Math.max(1, value))),
    pointerDown: (event) => {
      if (!modeEnabled || !options.selected || event.button !== 0) return;
      event.preventDefault();
      if (tool === "fill") {
        const selected = options.selected; const point = localPoint(event);
        const revision = operationRevision.current;
        const fillSelectionScope = selectionScope;
        const raster = selected.data.elements.find((element) => element.kind === "raster");
        const width = typeof raster?.width === "number" ? raster.width : options.parentSize.width;
        const height = typeof raster?.height === "number" ? raster.height : options.parentSize.height;
        void fillDrawingRegion({ elements: selected.data.elements, width, height, point, color })
          .then((filled) => {
            if (revision !== operationRevision.current || fillSelectionScope !== currentSelectionScope.current) return;
            options.replaceElements(selected.layerDocumentId, [filled]);
          });
        return;
      }
      activePointerId.current = event.pointerId;
      draftLayerDocumentId.current = options.selected.layerDocumentId;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDraftPoints([localPoint(event)]);
    },
    pointerMove: (event) => {
      if (activePointerId.current !== event.pointerId || draftPoints.length === 0) return;
      const point = localPoint(event);
      setDraftPoints((current) => [...current, point]);
    },
    pointerUp: (event) => {
      if (activePointerId.current !== event.pointerId) return;
      activePointerId.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      if (draftLayerDocumentId.current === options.selected?.layerDocumentId) commit(draftPoints);
      draftLayerDocumentId.current = null;
      setDraftPoints([]);
    },
    pointerCancel: () => { activePointerId.current = null; draftLayerDocumentId.current = null; setDraftPoints([]); },
  };
}
