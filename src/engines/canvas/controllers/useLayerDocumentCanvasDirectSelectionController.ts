import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  createCanvasSelectionAlphaBrowserAdapter,
} from "@/engines/canvas/adapters/canvasSelectionAlphaBrowserAdapter";
import {
  createCanvasSelectionHighlightRenderer,
} from "@/engines/canvas/adapters/canvasSelectionHighlightBrowserAdapter";
import {
  createSelectionSourceAlphaProvider,
} from "@/engines/canvas/helpers/selectionSourceAlphaProvider";
import {
  buildLayerDocumentCanvasHighlightSelectionKey,
  drawLayerDocumentCanvasHighlight,
  hitLayerDocumentCanvasDirectSelection,
  resolveLayerDocumentCanvasDirectSelectionIntent,
} from "@/engines/canvas/helpers/layerDocumentCanvasDirectSelectionHelpers";
import type {
  LayerDocumentCanvasCommands,
  LayerDocumentCanvasReadModel,
} from "@/engines/canvas/models/layerDocumentCanvasReadModel";
import type {
  SelectionSourceAlphaProvider,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";

function createProvider() {
  return createSelectionSourceAlphaProvider({
    adapter: createCanvasSelectionAlphaBrowserAdapter(),
  });
}

export function useLayerDocumentCanvasDirectSelectionController<
  TCommitResult,
  TSelectionResult,
  TKeyframeResult,
>(options: {
  overlayRef: RefObject<HTMLDivElement | null>;
  readModel: LayerDocumentCanvasReadModel;
  commands: LayerDocumentCanvasCommands<
    TCommitResult,
    TSelectionResult,
    TKeyframeResult
  >;
  isHighlightEnabled: boolean;
  isTransformDragging: boolean;
  viewportSize: { width: number; height: number };
  startPositionDrag: (
    clientX: number,
    clientY: number
  ) => void;
}) {
  const [isAlphaHit, setIsAlphaHit] = useState(false);
  const providerRef =
    useRef<SelectionSourceAlphaProvider | null>(null);
  if (providerRef.current == null) {
    providerRef.current = createProvider();
  }
  const highlightCanvasRef =
    useRef<HTMLCanvasElement | null>(null);
  const highlightRendererRef =
    useRef<ReturnType<
      typeof createCanvasSelectionHighlightRenderer
    > | null>(null);
  if (highlightRendererRef.current == null) {
    highlightRendererRef.current =
      createCanvasSelectionHighlightRenderer();
  }
  const previousSelectionKeyRef =
    useRef<string | null>(null);

  useEffect(() => () => {
    highlightRendererRef.current?.dispose(
      highlightCanvasRef.current
    );
    providerRef.current?.dispose();
    providerRef.current = null;
  }, []);

  const attachHighlightCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      highlightCanvasRef.current = canvas;
      if (!options.isHighlightEnabled) {
        highlightRendererRef.current?.clearSelection(canvas);
      }
    },
    [options.isHighlightEnabled]
  );

  useEffect(() => {
    const selectionKey =
      buildLayerDocumentCanvasHighlightSelectionKey(
        options.readModel.selectedHighlightCandidate
      );
    if (
      previousSelectionKeyRef.current !== selectionKey
    ) {
      highlightRendererRef.current?.clearSelection(
        highlightCanvasRef.current
      );
      previousSelectionKeyRef.current = selectionKey;
    }
    drawLayerDocumentCanvasHighlight({
      enabled: options.isHighlightEnabled,
      target: highlightCanvasRef.current,
      provider: providerRef.current,
      renderer: highlightRendererRef.current,
      candidate:
        options.readModel.selectedHighlightCandidate,
      viewportSize: options.viewportSize,
      devicePixelRatio:
        typeof window === "undefined"
          ? 1
          : window.devicePixelRatio || 1,
    });
  }, [
    options.isHighlightEnabled,
    options.readModel.selectedHighlightCandidate,
    options.viewportSize,
  ]);

  const hitAt = useCallback(
    (
      clientX: number,
      clientY: number,
      cacheMode: "selection" | "hover"
    ) => {
      const bounds =
        options.overlayRef.current
          ?.getBoundingClientRect();
      const provider = providerRef.current;
      if (!bounds || !provider) return null;
      return hitLayerDocumentCanvasDirectSelection({
        point: {
          x: clientX - bounds.left,
          y: clientY - bounds.top,
        },
        candidates:
          options.readModel
            .directSelectionCandidates,
        provider,
        compositionSize: {
          width: options.readModel.activeScene.width,
          height: options.readModel.activeScene.height,
        },
        viewportScale:
          options.readModel.viewport.viewportScale,
        viewportOffset:
          options.readModel.viewport.viewportOffset,
        cacheMode,
      });
    },
    [options.overlayRef, options.readModel]
  );

  const pressTarget = useCallback(
    (clientX: number, clientY: number) => {
      const hit = hitAt(
        clientX,
        clientY,
        "selection"
      );
      if (!hit) return;
      const intent =
        resolveLayerDocumentCanvasDirectSelectionIntent(
          hit,
          options.readModel.selectedLayerDocumentId
        );
      if (intent.type === "drag") {
        options.startPositionDrag(clientX, clientY);
      } else if (intent.type === "select") {
        options.commands.directSelect(
          intent.layerDocumentId
        );
      } else if (intent.type === "clear") {
        options.commands.directSelect(null);
      }
    },
    [hitAt, options]
  );

  const moveTarget = useCallback(
    (clientX: number, clientY: number) => {
      if (
        options.isTransformDragging ||
        options.readModel
          .hoverSuppressedDuringTransform
      ) {
        setIsAlphaHit(false);
        return;
      }
      const hit = hitAt(clientX, clientY, "hover");
      setIsAlphaHit(hit?.status === "hit");
    },
    [hitAt, options]
  );

  const doubleClickTarget = useCallback(
    (clientX: number, clientY: number) => {
      const hit = hitAt(clientX, clientY, "hover");
      if (hit?.status !== "hit") return;
      if (hit.candidate.targetKind === "group") {
        options.commands.enterGroup(
          hit.candidate.layerDocumentId
        );
      }
    },
    [hitAt, options]
  );

  const leaveTarget = useCallback(
    () => setIsAlphaHit(false),
    []
  );

  return {
    pressTarget,
    hover: {
      isAlphaHit,
      moveTarget,
      leaveTarget,
      doubleClickTarget,
    },
    highlight: { attachCanvas: attachHighlightCanvas },
  };
}
