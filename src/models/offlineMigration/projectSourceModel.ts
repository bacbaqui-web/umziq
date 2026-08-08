import type {
  OpacityKeyframe,
  PositionKeyframe,
  PropertyTrackState,
  RotationKeyframe,
  ScaleKeyframe,
} from "@/models/animationModel";
import type { CompositionMeta, SourceSyncStatus } from "@/models/offlineMigration/compositionModel";
import type { ModifierInstance } from "@/models/modifierModel";
import type { PlainDataObject } from "@/models/plainDataModel";
import type { PsdImportSettings } from "@/models/psdImportSettingsModel";
import type { PsdSourceIdentity } from "@/models/psdSourceIdentityModel";
import type { TimelineItemReference } from "@/models/offlineMigration/timelineItemModel";
import type { Position, Scale } from "@/models/transformModel";

export const PROJECT_SOURCE_SCHEMA_VERSION = 1 as const;
export const PROJECT_SOURCE_VERSION = 1 as const;

export type SupportedLayerType =
  | "psd"
  | "drawing"
  | "text"
  | "audio"
  | "group";

export type FutureLayerType = "video" | "shape";
export type LayerType = SupportedLayerType | FutureLayerType | "unknown";
export type SourceAvailability = "available" | "missing";
export type LayerTypeSupport = "supported" | "future" | "unknown";

export function normalizeLayerType(type: unknown): LayerType {
  switch (type) {
    case "psd":
    case "drawing":
    case "text":
    case "audio":
    case "group":
    case "video":
    case "shape":
      return type;
    default:
      return "unknown";
  }
}

export function getLayerTypeSupport(type: LayerType): LayerTypeSupport {
  if (type === "video" || type === "shape") return "future";
  if (type === "unknown") return "unknown";
  return "supported";
}

export interface ProjectSourceTransform {
  position: Position;
  transformOffset: Position;
  anchor: Position;
  scale: Scale;
  scaleLinked: boolean;
  rotation: number;
  opacity: number;
}

export interface ProjectSourceAnimation {
  positionKeyframes: PositionKeyframe[];
  scaleKeyframes: ScaleKeyframe[];
  rotationKeyframes: RotationKeyframe[];
  opacityKeyframes: OpacityKeyframe[];
  enabledProperties: PropertyTrackState;
}

export interface ProjectEffect {
  effectId: string;
  type: string;
  enabled: boolean;
  parameters: PlainDataObject;
}

export interface ProjectSourceBase<
  TType extends LayerType,
  TContent extends PlainDataObject,
> {
  sourceId: string;
  type: TType;
  name: string;
  availability: SourceAvailability;
  syncStatus: SourceSyncStatus;
  sourceVersion: number;
  transform: ProjectSourceTransform;
  animation: ProjectSourceAnimation;
  modifiers: ModifierInstance[];
  effects: ProjectEffect[];
  content: TContent;
}

export interface PsdLayerContent extends PlainDataObject {
  sourceIdentity: PsdSourceIdentity | null;
  sourcePath: string | null;
  sourceFingerprint: string | null;
}

export interface DrawingLayerContent extends PlainDataObject {
  documentVersion: number;
  elements: PlainDataObject[];
}

export interface TextLayerContent extends PlainDataObject {
  text: string;
  style: {
    fontFamily: string;
    fontSize: number;
    color: string;
  };
}

export interface AudioLayerContent extends PlainDataObject {
  descriptor:
    | { kind: "empty" }
    | {
        kind: "file";
        fileName: string;
        mimeType: string | null;
      };
  durationFrames: number | null;
}

export interface GroupSourceContent extends PlainDataObject {
  timelineId: string;
  legacyCompositionType: "master" | "main" | "sub" | null;
  sourceIdentity: PsdSourceIdentity | null;
  sourcePath: string | null;
  sourceFingerprint: string | null;
  importSettings: PsdImportSettings | null;
}

export interface UnsupportedLayerContent extends PlainDataObject {
  originalType: string;
  data: PlainDataObject;
}

export type PsdLayerSource = ProjectSourceBase<"psd", PsdLayerContent>;
export type DrawingLayerSource = ProjectSourceBase<
  "drawing",
  DrawingLayerContent
>;
export type TextLayerSource = ProjectSourceBase<"text", TextLayerContent>;
export type AudioLayerSource = ProjectSourceBase<"audio", AudioLayerContent>;
export type GroupSource = ProjectSourceBase<"group", GroupSourceContent>;
export type FutureLayerSource = ProjectSourceBase<
  FutureLayerType,
  UnsupportedLayerContent
>;
export type UnknownLayerSource = ProjectSourceBase<
  "unknown",
  UnsupportedLayerContent
>;

export type ProjectSource =
  | PsdLayerSource
  | DrawingLayerSource
  | TextLayerSource
  | AudioLayerSource
  | GroupSource
  | FutureLayerSource
  | UnknownLayerSource;

export interface ProjectSourceDocument {
  schemaVersion: typeof PROJECT_SOURCE_SCHEMA_VERSION;
  sourcesById: Record<string, ProjectSource>;
  rootSourceIds: string[];
  timelineItemsByGroupId: Record<string, TimelineItemReference[]>;
  compositionMetaByGroupId: Record<string, CompositionMeta>;
}
