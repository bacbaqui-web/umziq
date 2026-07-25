import type { EvaluatedSceneTransform } from "@/engines/playback-render";

export type SelectionAlphaSize = {
  readonly width: number;
  readonly height: number;
};

export type SelectionAlphaVisualKey = string | number;

type SelectionAlphaDescriptorBase = {
  readonly logicalSize: SelectionAlphaSize;
  readonly sourceFingerprint: string | null;
  readonly sourceRevision: SelectionAlphaVisualKey;
  readonly frameVisualKey: SelectionAlphaVisualKey;
  readonly opacity: number;
  readonly visible: boolean;
};

export type SelectionLayerAlphaDescriptor = SelectionAlphaDescriptorBase & {
  readonly kind: "layer";
  readonly sourceCanvas: HTMLCanvasElement;
};

export type SelectionSolidAlphaDescriptor = SelectionAlphaDescriptorBase & {
  readonly kind: "solid";
};

export type SelectionSubCompositionAlphaChild = {
  readonly source: SelectionSourceAlphaDescriptor;
  readonly transform: EvaluatedSceneTransform;
};

export type SelectionSubCompositionAlphaDescriptor =
  SelectionAlphaDescriptorBase & {
    readonly kind: "subComp";
    readonly orderedChildren: readonly SelectionSubCompositionAlphaChild[];
  };

export type SelectionSourceAlphaDescriptor =
  | SelectionLayerAlphaDescriptor
  | SelectionSolidAlphaDescriptor
  | SelectionSubCompositionAlphaDescriptor;

export type SelectionSourceAlphaEntry = {
  readonly visualFingerprint: string;
  readonly width: number;
  readonly height: number;
  readonly alphaBytes: Uint8Array;
  readonly sample: (x: number, y: number) => number;
};

export type SelectionSourceAlphaUnavailableReason =
  | "context-unavailable"
  | "invalid-descriptor"
  | "draw-failed"
  | "readback-blocked"
  | "disposed"
  | "not-retained";

export type SelectionSourceAlphaResult =
  | {
      readonly status: "ready";
      readonly entry: SelectionSourceAlphaEntry;
    }
  | {
      readonly status: "unavailable";
      readonly visualFingerprint: string;
      readonly reason: SelectionSourceAlphaUnavailableReason;
    };

export type SelectionSourceAlphaProviderEvent = {
  readonly type: "build" | "reuse" | "release" | "failure";
  readonly visualFingerprint: string;
};

export type SelectionSourceAlphaProvider = {
  readonly get: (
    descriptor: SelectionSourceAlphaDescriptor
  ) => SelectionSourceAlphaResult;
  readonly retain: (visualFingerprints: readonly string[]) => void;
  readonly release: (visualFingerprint: string) => void;
  readonly clear: () => void;
  readonly dispose: () => void;
};

export type SelectionAlphaBrowserAdapter = {
  readonly build: (
    descriptor: SelectionSourceAlphaDescriptor,
    visualFingerprint: string
  ) => SelectionSourceAlphaResult;
};
