import type { CanvasSize } from "@/engines/canvas/models/canvasEngineModel";

type WorkspaceElement = {
  getBoundingClientRect: () => { width: number; height: number };
};

type ResizeObserverLike = {
  observe: (target: Element) => void;
  disconnect: () => void;
};

type ResizeObserverConstructor = new (
  callback: ResizeObserverCallback
) => ResizeObserverLike;

export function measureCanvasWorkspace(element: WorkspaceElement): CanvasSize {
  const bounds = element.getBoundingClientRect();
  return {
    width: Math.max(0, Math.floor(Number.isFinite(bounds.width) ? bounds.width : 0)),
    height: Math.max(0, Math.floor(Number.isFinite(bounds.height) ? bounds.height : 0)),
  };
}

export function observeCanvasWorkspace(
  element: HTMLElement,
  onSize: (size: CanvasSize) => void,
  ResizeObserverApi: ResizeObserverConstructor = ResizeObserver
) {
  const update = () => onSize(measureCanvasWorkspace(element));
  update();
  const observer = new ResizeObserverApi(update);
  observer.observe(element);
  return () => observer.disconnect();
}
