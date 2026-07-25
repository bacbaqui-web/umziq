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
  createCanvasSelectionGlowRenderer,
} from "@/engines/canvas/adapters/canvasSelectionGlowBrowserAdapter";
import {
  buildLayerDocumentCanvasGlowSelectionKey,
  drawLayerDocumentCanvasGlow,
  hitLayerDocumentCanvasDirectSelection,
  resolveLayerDocumentCanvasDirectSelectionIntent,
} from "@/engines/canvas/helpers/layerDocumentCanvasDirectSelectionHelpers";
import {
  createSelectionSourceAlphaProvider,
} from "@/engines/canvas/helpers/selectionSourceAlphaProvider";
import type {
  LayerDocumentCanvasCommands,
  LayerDocumentCanvasModeReadModel,
} from "@/engines/canvas/models/layerDocumentCanvasModeModel";
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
  readModel: LayerDocumentCanvasModeReadModel;
  commands: LayerDocumentCanvasCommands<
    TCommitResult,
    TSelectionResult,
    TKeyframeResult
  >;
  isGlowEnabled: boolean;
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
  const glowCanvasRef =
    useRef<HTMLCanvasElement | null>(null);
  const glowRendererRef =
    useRef<ReturnType<
      typeof createCanvasSelectionGlowRenderer
    > | null>(null);
  if (glowRendererRef.current == null) {
    glowRendererRef.current =
      createCanvasSelectionGlowRenderer();
  }
  const previousSelectionKeyRef =
    useRef<string | null>(null);

  useEffect(() => () => {
    glowRendererRef.current?.dispose(
      glowCanvasRef.current
    );
    providerRef.current?.dispose();
    providerRef.current = null;
  }, []);

  const attachGlowCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      glowCanvasRef.current = canvas;
      if (!options.isGlowEnabled) {
        glowRendererRef.current?.clearSelection(canvas);
      }
    },
    [options.isGlowEnabled]
  );

  useEffect(() => {
    const selectionKey =
      buildLayerDocumentCanvasGlowSelectionKey(
        options.readModel.selectedGlowCandidate
      );
    if (
      previousSelectionKeyRef.current !== selectionKey
    ) {
      glowRendererRef.current?.clearSelection(
        glowCanvasRef.current
      );
      previousSelectionKeyRef.current = selectionKey;
    }
    drawLayerDocumentCanvasGlow({
      enabled: options.isGlowEnabled,
      target: glowCanvasRef.current,
      provider: providerRef.current,
      renderer: glowRendererRef.current,
      candidate:
        options.readModel.selectedGlowCandidate,
      viewportSize: options.viewportSize,
      devicePixelRatio:
        typeof window === "undefined"
          ? 1
          : window.devicePixelRatio || 1,
    });
  }, [
    options.isGlowEnabled,
    options.readModel.selectedGlowCandidate,
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
    glow: { attachCanvas: attachGlowCanvas },
  };
}
