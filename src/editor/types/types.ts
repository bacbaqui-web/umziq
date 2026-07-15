export type CompType = "master" | "main" | "sub";
export type AnimatableProperty = "position" | "scale" | "rotation" | "opacity";
export type SourceSyncStatus = "normal" | "updated" | "new" | "deletePending" | "missing";

export interface PropertyTrackState {
  position: boolean;
  scale: boolean;
  rotation: boolean;
  opacity: boolean;
}

export function createPropertyTrackState(
  overrides: Partial<PropertyTrackState> = {}
): PropertyTrackState {
  return {
    position: false,
    scale: false,
    rotation: false,
    opacity: false,
    ...overrides,
  };
}

export interface Position {
  x: number;
  y: number;
}

export interface Scale {
  x: number;
  y: number;
}

export interface PositionKeyframe {
  frame: number;
  value: Position;
}

export interface ScaleKeyframe {
  frame: number;
  value: Scale;
}

export interface RotationKeyframe {
  frame: number;
  value: number;
}

export interface OpacityKeyframe {
  frame: number;
  value: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  sourcePath?: string;
  sourceFingerprint?: string;
  sourceSyncStatus?: SourceSyncStatus;
  position: Position;
  transformOffset: Position;
  anchor: Position;
  positionKeyframes: PositionKeyframe[];
  scale: Scale;
  scaleKeyframes: ScaleKeyframe[];
  scaleLinked: boolean;
  rotation: number;
  rotationKeyframes: RotationKeyframe[];
  opacity: number;
  opacityKeyframes: OpacityKeyframe[];
  enabledProperties: PropertyTrackState;
}

export interface Composition {
  id: string;
  name: string;
  type: CompType;
  parentId?: string;
  sourcePath?: string;
  sourceFingerprint?: string;
  sourceSyncStatus?: SourceSyncStatus;
  children?: Composition[];
  layers: Layer[];
  position: Position;
  positionKeyframes: PositionKeyframe[];
  transformOffset: Position;
  anchor: Position;
  scale: Scale;
  scaleKeyframes: ScaleKeyframe[];
  scaleLinked: boolean;
  rotation: number;
  rotationKeyframes: RotationKeyframe[];
  opacity: number;
  opacityKeyframes: OpacityKeyframe[];
  enabledProperties: PropertyTrackState;
}

export interface CompositionMeta {
  width: number;
  height: number;
  layerCount: number;
  sourceFileName: string;
  frameRate: number;
  durationFrames: number;
}

export type TimelineItemKind = "layer" | "subComp";

export interface TimelineItem {
  id: string;
  name: string;
  kind: TimelineItemKind;
  visible: boolean;
  compId: string;
  sourceId: string;
  startFrame: number;
  durationFrames: number;
  targetCompId?: string;
}

export interface RenderDrawable {
  id: string;
  left: number;
  top: number;
  visible: boolean;
  sourceLayerId?: string;
  canvas?: HTMLCanvasElement;
}

export interface RenderItem {
  id: string;
  name: string;
  kind: TimelineItemKind;
  visible: boolean;
  sourceId: string;
  targetCompId?: string;
  drawables: RenderDrawable[];
}
