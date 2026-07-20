import type {
  OpacityKeyframe,
  PositionKeyframe,
  PropertyTrackState,
  RotationKeyframe,
  ScaleKeyframe,
} from "@/models/animationModel";
import type { Position, Scale } from "@/models/transformModel";
import type { ModifierInstance } from "@/models/modifierModel";
import type { PsdSourceIdentity } from "@/models/psdSourceIdentityModel";
import type { PsdImportSettings } from "@/models/psdImportSettingsModel";

export type CompType = "master" | "main" | "sub";
export type SourceSyncStatus = "normal" | "updated" | "new" | "deletePending" | "missing";

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  sourcePath?: string;
  sourceIdentity?: PsdSourceIdentity;
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
  modifiers: ModifierInstance[];
}

export interface Composition {
  id: string;
  name: string;
  type: CompType;
  parentId?: string;
  sourcePath?: string;
  sourceIdentity?: PsdSourceIdentity;
  importSettings?: PsdImportSettings;
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
  modifiers: ModifierInstance[];
}

export interface CompositionMeta {
  width: number;
  height: number;
  layerCount: number;
  sourceFileName: string;
  frameRate: number;
  durationFrames: number;
}
