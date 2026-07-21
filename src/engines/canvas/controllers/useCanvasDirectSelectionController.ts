import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type {
  Composition,
  CompositionMeta,
  Layer,
  TimelineItem,
  TimelineSelection,
} from "@/models";
import type { RenderItem } from "@/engines/project";
import type { EvaluatedScene } from "@/engines/playback-render";
import { createCanvasSelectionAlphaBrowserAdapter } from "@/engines/canvas/adapters/canvasSelectionAlphaBrowserAdapter";
import { createCanvasSelectionGlowRenderer } from "@/engines/canvas/adapters/canvasSelectionGlowBrowserAdapter";
import {
  applyCanvasDirectSelectionDraft,
  buildCanvasDirectSelectionStaticCandidates,
  buildCanvasDirectSelectionViewportCandidates,
} from "@/engines/canvas/helpers/canvasDirectSelectionCandidateHelpers";
import {
  hitCanvasDirectSelection,
  resolveCanvasDirectSelectionCompositionEntry,
  resolveCanvasDirectSelectionIntent,
} from "@/engines/canvas/helpers/canvasDirectSelectionHitHelpers";
import {
  buildCanvasSelectionGlowSelectionKey,
  drawSelectedCanvasGlow,
  releaseCanvasSelectionGlow,
  resolveSelectedCanvasGlowCandidate,
} from "@/engines/canvas/helpers/canvasSelectionGlowHelpers";
import type { DraftTransformSnapshot } from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import { createSelectionSourceAlphaProvider } from "@/engines/canvas/helpers/selectionSourceAlphaProvider";
import type { SelectionSourceAlphaProvider } from "@/engines/canvas/models/canvasSelectionAlphaModel";

type UseCanvasDirectSelectionControllerOptions = {
  overlayRef: RefObject<HTMLDivElement | null>;
  selectedCompId: string | null;
  evaluatedScene: EvaluatedScene | null;
  renderItems: readonly RenderItem[];
  timelineItems: readonly TimelineItem[];
  layersById: ReadonlyMap<string, Layer>;
  compositionsById: ReadonlyMap<string, Composition>;
  metaByCompId: Readonly<Record<string, CompositionMeta>>;
  viewportScale: number;
  viewportOffset: { x: number; y: number };
  viewportSize: { width: number; height: number };
  selectedTimelineItem: TimelineItem | null;
  draftTransformSnapshot: DraftTransformSnapshot | null;
  isGlowEnabled: boolean;
  applySelection: (compId: string, selection: TimelineSelection) => void;
  enterComposition: (compId: string) => void;
  startPositionDrag: (clientX: number, clientY: number) => void;
};

function createProvider() {
  return createSelectionSourceAlphaProvider({
    adapter: createCanvasSelectionAlphaBrowserAdapter(),
  });
}

export function useCanvasDirectSelectionController(
  options: UseCanvasDirectSelectionControllerOptions
) {
  const viewportWidth = options.viewportSize.width;
  const viewportHeight = options.viewportSize.height;
  const [isAlphaHit, setIsAlphaHit] = useState(false);
  const providerRef = useRef<SelectionSourceAlphaProvider | null>(null);
  if (providerRef.current == null) providerRef.current = createProvider();
  const glowCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const glowRendererRef = useRef<ReturnType<typeof createCanvasSelectionGlowRenderer> | null>(null);
  if (glowRendererRef.current == null) {
    glowRendererRef.current = createCanvasSelectionGlowRenderer();
  }
  const attachGlowCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    glowCanvasRef.current = canvas;
    if (!options.isGlowEnabled) {
      glowRendererRef.current?.clearSelection(canvas);
    }
  }, [options.isGlowEnabled]);
  const alphaSourceSnapshot: readonly unknown[] = [
    options.renderItems,
    ...options.renderItems.flatMap((item) => [
      item.id,
      item.sourceId,
      ...item.drawables.flatMap((drawable) => [
        drawable.id,
        drawable.sourceLayerId,
        drawable.canvas,
      ]),
    ]),
  ];
  const previousAlphaSourceSnapshotRef = useRef<readonly unknown[] | null>(null);
  const previousGlowSelectionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!providerRef.current) providerRef.current = createProvider();
    const glowCanvas = glowCanvasRef.current;
    return () => {
      glowRendererRef.current?.dispose(glowCanvas);
      providerRef.current?.dispose();
      providerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const previous = previousAlphaSourceSnapshotRef.current;
    const replaced = previous === null || previous.length !== alphaSourceSnapshot.length ||
      previous.some((value, index) => !Object.is(value, alphaSourceSnapshot[index]));
    if (replaced) {
      glowRendererRef.current?.clearSelection(glowCanvasRef.current);
      providerRef.current?.clear();
    }
    previousAlphaSourceSnapshotRef.current = alphaSourceSnapshot;
  });

  const staticCandidates = useMemo(
    () => buildCanvasDirectSelectionStaticCandidates({
      evaluatedScene: options.evaluatedScene,
      renderItems: options.renderItems,
      timelineItems: options.timelineItems,
      layersById: options.layersById,
      compositionsById: options.compositionsById,
    }),
    [
      options.compositionsById,
      options.evaluatedScene,
      options.layersById,
      options.renderItems,
      options.timelineItems,
    ]
  );
  const viewportCandidates = useMemo(
    () => buildCanvasDirectSelectionViewportCandidates({
      staticCandidates,
      viewportScale: options.viewportScale,
      viewportOffset: options.viewportOffset,
    }),
    [staticCandidates, options.viewportOffset, options.viewportScale]
  );
  const candidates = useMemo(
    () => applyCanvasDirectSelectionDraft({
      staticCandidates,
      viewportCandidates,
      viewportScale: options.viewportScale,
      viewportOffset: options.viewportOffset,
      selectedTimelineItem: options.selectedTimelineItem,
      draftTransformSnapshot: options.draftTransformSnapshot,
    }),
    [
      options.draftTransformSnapshot,
      options.selectedTimelineItem,
      options.viewportOffset,
      options.viewportScale,
      staticCandidates,
      viewportCandidates,
    ]
  );
  const selectedGlowCandidate = useMemo(
    () => resolveSelectedCanvasGlowCandidate(
      candidates,
      options.selectedTimelineItem
    ),
    [candidates, options.selectedTimelineItem]
  );

  useEffect(() => {
    if (options.isGlowEnabled) return;
    releaseCanvasSelectionGlow({
      target: glowCanvasRef.current,
      provider: providerRef.current,
      renderer: glowRendererRef.current,
    });
  }, [options.isGlowEnabled]);

  useEffect(() => {
    if (!options.isGlowEnabled) return;
    const target = glowCanvasRef.current;
    const provider = providerRef.current;
    const renderer = glowRendererRef.current;
    const selectionKey = buildCanvasSelectionGlowSelectionKey(selectedGlowCandidate);
    if (previousGlowSelectionKeyRef.current !== selectionKey) {
      renderer?.clearSelection(target);
      previousGlowSelectionKeyRef.current = selectionKey;
    }
    drawSelectedCanvasGlow({
      enabled: options.isGlowEnabled,
      target,
      provider,
      renderer,
      candidate: selectedGlowCandidate,
      selectedTimelineItem: options.selectedTimelineItem,
      viewportSize: { width: viewportWidth, height: viewportHeight },
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  }, [
    options.selectedTimelineItem,
    options.isGlowEnabled,
    selectedGlowCandidate,
    viewportHeight,
    viewportWidth,
  ]);

  const pressTarget = useCallback((clientX: number, clientY: number) => {
    const provider = providerRef.current;
    const scene = options.evaluatedScene;
    const compId = options.selectedCompId;
    const bounds = options.overlayRef.current?.getBoundingClientRect();
    if (!provider || !scene || !compId || !bounds) return;
    const hit = hitCanvasDirectSelection({
      point: { x: clientX - bounds.left, y: clientY - bounds.top },
      candidates,
      provider,
      compositionSize: scene.size,
      viewportScale: options.viewportScale,
      viewportOffset: options.viewportOffset,
    });
    const intent = resolveCanvasDirectSelectionIntent(
      hit,
      options.selectedTimelineItem
    );
    if (intent.type === "drag") options.startPositionDrag(clientX, clientY);
    else if (intent.type === "select") options.applySelection(compId, intent.selection);
    else if (intent.type === "clear") options.applySelection(compId, null);
  }, [candidates, options]);

  const moveTarget = useCallback((clientX: number, clientY: number) => {
    const provider = providerRef.current;
    const scene = options.evaluatedScene;
    const bounds = options.overlayRef.current?.getBoundingClientRect();
    if (!provider || !scene || !bounds) {
      setIsAlphaHit(false);
      return;
    }
    const hit = hitCanvasDirectSelection({
      point: { x: clientX - bounds.left, y: clientY - bounds.top },
      candidates,
      provider,
      compositionSize: scene.size,
      viewportScale: options.viewportScale,
      viewportOffset: options.viewportOffset,
      cacheMode: "hover",
    });
    setIsAlphaHit(hit.status === "hit");
  }, [candidates, options]);

  const doubleClickTarget = useCallback((clientX: number, clientY: number) => {
    const provider = providerRef.current;
    const scene = options.evaluatedScene;
    const bounds = options.overlayRef.current?.getBoundingClientRect();
    if (!provider || !scene || !bounds) return;
    const hit = hitCanvasDirectSelection({
      point: { x: clientX - bounds.left, y: clientY - bounds.top },
      candidates,
      provider,
      compositionSize: scene.size,
      viewportScale: options.viewportScale,
      viewportOffset: options.viewportOffset,
      cacheMode: "hover",
    });
    const targetCompId = resolveCanvasDirectSelectionCompositionEntry(hit);
    if (targetCompId) options.enterComposition(targetCompId);
  }, [candidates, options]);

  const leaveTarget = useCallback(() => setIsAlphaHit(false), []);

  return {
    pressTarget,
    hover: { isAlphaHit, moveTarget, leaveTarget, doubleClickTarget },
    glow: { attachCanvas: attachGlowCanvas },
  };
}
