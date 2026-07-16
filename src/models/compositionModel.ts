import type {
  OpacityKeyframe,
  PositionKeyframe,
  PropertyTrackState,
  RotationKeyframe,
  ScaleKeyframe,
} from "@/models/animationModel";
import type { Position, Scale } from "@/models/transformModel";

export type CompType = "master" | "main" | "sub";
export type SourceSyncStatus = "normal" | "updated" | "new" | "deletePending" | "missing";

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
