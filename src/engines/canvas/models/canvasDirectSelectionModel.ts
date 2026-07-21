import type { TimelineItem, TimelineSelection } from "@/models";
import type { RenderDrawable } from "@/engines/project";
import type { SelectionSourceAlphaDescriptor } from "@/engines/canvas/models/canvasSelectionAlphaModel";

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

type CanvasSelectionCandidateBase = {
  readonly sceneNodeIndex: number;
  readonly renderItemId: string;
  readonly sourceId: string;
  readonly drawable: RenderDrawable | null;
  readonly target: { readonly kind: "layer" | "composition"; readonly id: string } | null;
  readonly timelineItem: TimelineItem | null;
  readonly projection: CanvasSelectionProjection;
};

export type CanvasReadySelectionCandidate = CanvasSelectionCandidateBase & {
  readonly status: "ready";
  readonly selection: NonNullable<TimelineSelection>;
  readonly descriptor: SelectionSourceAlphaDescriptor;
};

export type CanvasBlockedSelectionCandidate = CanvasSelectionCandidateBase & {
  readonly status: "blocked";
  readonly reason: "ambiguous-identity" | "missing-drawable";
};

export type CanvasSelectionCandidate =
  | CanvasReadySelectionCandidate
  | CanvasBlockedSelectionCandidate;

export type CanvasDirectSelectionHit =
  | { readonly status: "hit"; readonly candidate: CanvasReadySelectionCandidate }
  | { readonly status: "blocked"; readonly candidate: CanvasSelectionCandidate }
  | { readonly status: "none" };

export type CanvasDirectSelectionIntent =
  | { readonly type: "drag" }
  | { readonly type: "select"; readonly selection: NonNullable<TimelineSelection> }
  | { readonly type: "clear" }
  | { readonly type: "preserve" };

export type CanvasDirectSelectionHoverViewModel = {
  readonly isAlphaHit: boolean;
  readonly moveTarget: (clientX: number, clientY: number) => void;
  readonly leaveTarget: () => void;
  readonly doubleClickTarget: (clientX: number, clientY: number) => void;
};
