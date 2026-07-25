export type CanvasSelectionPoint = { readonly x: number; readonly y: number };

export type CanvasSelectionMatrix = {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
};

export type CanvasSelectionProjection = {
  readonly sourceToViewport: CanvasSelectionMatrix;
  readonly viewportQuad: readonly [
    CanvasSelectionPoint,
    CanvasSelectionPoint,
    CanvasSelectionPoint,
    CanvasSelectionPoint,
  ];
  readonly viewportBounds: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
  readonly viewportToSource: CanvasSelectionMatrix;
};

export type CanvasDirectSelectionHoverViewModel = {
  readonly isAlphaHit: boolean;
  readonly moveTarget: (clientX: number, clientY: number) => void;
  readonly leaveTarget: () => void;
  readonly doubleClickTarget: (clientX: number, clientY: number) => void;
};
