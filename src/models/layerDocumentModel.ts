import type { PlainDataObject } from "@/models/plainDataModel";
import type { Position, Scale } from "@/models/transformModel";

export const LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION = 1 as const;

export type LayerDocumentType =
  | "psd"
  | "drawing"
  | "text"
  | "audio"
  | "video"
  | "shape"
  | "group"
  | "unknown";

export type SourceRegistryKind =
  | "psd-document"
  | "psd-node"
  | "audio"
  | "video"
  | "unknown";

export type SourceRegistryAvailability = "available" | "missing";

export type SourceRegistryRefreshStatus =
  | "normal"
  | "updated"
  | "new"
  | "deletePending"
  | "missing";

export interface SourceRegistryReconnectHint {
  fileName: string;
  path: string | null;
}

export interface SourceRegistryRefresh {
  status: SourceRegistryRefreshStatus;
  reconnectHint: SourceRegistryReconnectHint | null;
}

export interface SourceRegistryRecordBase<
  TKind extends SourceRegistryKind,
  TData,
> {
  sourceId: string;
  kind: TKind;
  displayName: string;
  path: string | null;
  fingerprint: string | null;
  version: number;
  availability: SourceRegistryAvailability;
  refresh: SourceRegistryRefresh;
  data: TData;
}

export interface PsdDocumentSourceData {
  fileName: string;
  importSettings: {
    compositionName: string;
    hiddenLayerMode: "preserve" | "omit";
  };
}

export interface PsdNodeSourceData {
  documentSourceId: string;
  sourceKey: string;
  sourcePath: string;
  nativeVisible: boolean | null;
}

export interface AudioSourceData {
  fileName: string;
  mimeType: string | null;
  durationFrames: number | null;
}

export interface VideoSourceData {
  fileName: string;
  mimeType: string | null;
  durationFrames: number | null;
  width: number | null;
  height: number | null;
}

export interface UnknownSourceData {
  originalKind: string;
  rawData: PlainDataObject;
}

export type PsdDocumentSourceRecord = SourceRegistryRecordBase<
  "psd-document",
  PsdDocumentSourceData
>;

export type PsdNodeSourceRecord = SourceRegistryRecordBase<
  "psd-node",
  PsdNodeSourceData
>;

export type AudioSourceRecord = SourceRegistryRecordBase<
  "audio",
  AudioSourceData
>;

export type VideoSourceRecord = SourceRegistryRecordBase<
  "video",
  VideoSourceData
>;

export type UnknownSourceRecord = SourceRegistryRecordBase<
  "unknown",
  UnknownSourceData
>;

export type SourceRegistryRecord =
  | PsdDocumentSourceRecord
  | PsdNodeSourceRecord
  | AudioSourceRecord
  | VideoSourceRecord
  | UnknownSourceRecord;

export interface SourceRegistry {
  sourcesById: Record<string, SourceRegistryRecord>;
}

export interface LayerSourceReference {
  sourceId: string;
}

export interface LayerTransform {
  position: Position;
  transformOffset: Position;
  anchor: Position;
  scale: Scale;
  scaleLinked: boolean;
  rotation: number;
  opacity: number;
}

export interface LayerPlacement {
  parentLayerDocumentId: string | null;
  order: number;
  startFrame: number;
  durationFrames: number;
  sourceOffsetFrames: number;
  visible: boolean;
  /**
   * The displayed Layer label is alias ?? LayerDocument.name.
   * Source Registry displayName describes the resource, not this edit label.
   */
  alias: string | null;
}

export interface LayerPositionKeyframe {
  frame: number;
  value: Position;
}

export interface LayerScaleKeyframe {
  frame: number;
  value: Scale;
}

export interface LayerNumberKeyframe {
  frame: number;
  value: number;
}

export interface LayerAnimation {
  positionKeyframes: LayerPositionKeyframe[];
  scaleKeyframes: LayerScaleKeyframe[];
  rotationKeyframes: LayerNumberKeyframe[];
  opacityKeyframes: LayerNumberKeyframe[];
  enabledProperties: {
    position: boolean;
    scale: boolean;
    rotation: boolean;
    opacity: boolean;
  };
}

export interface LayerEffect {
  effectId: string;
  type: string;
  enabled: boolean;
  parameters: PlainDataObject;
}

export type LayerModifier =
  | {
      modifierId: string;
      type: "wiggle";
      enabled: boolean;
      frequency: number;
      amount: number;
    }
  | {
      modifierId: string;
      type: "unknown";
      enabled: boolean;
      originalType: string;
      parameters: PlainDataObject;
    };

export interface LayerDocumentCommon<
  TSource extends LayerSourceReference | null =
    LayerSourceReference | null,
> {
  source: TSource;
  transform: LayerTransform;
  placement: LayerPlacement;
  animation: LayerAnimation;
  effects: LayerEffect[];
  modifiers: LayerModifier[];
}

export type PsdLayerData = Record<string, never>;

export interface DrawingLayerData {
  documentVersion: number;
  elements: PlainDataObject[];
}

export interface TextLayerData {
  text: string;
  style: {
    fontFamily: string;
    fontSize: number;
    color: string;
  };
}

export type AudioLayerData = Record<string, never>;

export type VideoLayerData = Record<string, never>;

export interface ShapeLayerData {
  documentVersion: number;
  shapes: PlainDataObject[];
}

export interface GroupLayerData {
  role: "project-root" | "composition";
  width: number;
  height: number;
  frameRate: number;
  durationFrames: number;
}

export interface UnknownLayerData {
  originalType: string;
  rawData: PlainDataObject;
}

export interface LayerDocumentBase<
  TType extends LayerDocumentType,
  TData,
  TSource extends LayerSourceReference | null =
    LayerSourceReference | null,
> {
  layerDocumentId: string;
  name: string;
  revision: number;
  type: TType;
  common: LayerDocumentCommon<TSource>;
  data: TData;
}

export type PsdLayerDocument = LayerDocumentBase<
  "psd",
  PsdLayerData,
  LayerSourceReference
>;

export type DrawingLayerDocument = LayerDocumentBase<
  "drawing",
  DrawingLayerData,
  null
>;

export type TextLayerDocument = LayerDocumentBase<
  "text",
  TextLayerData,
  null
>;

export type AudioLayerDocument = LayerDocumentBase<
  "audio",
  AudioLayerData
>;

export type VideoLayerDocument = LayerDocumentBase<
  "video",
  VideoLayerData
>;

export type ShapeLayerDocument = LayerDocumentBase<
  "shape",
  ShapeLayerData,
  null
>;

export type GroupLayerDocument = LayerDocumentBase<
  "group",
  GroupLayerData
>;

export type UnknownLayerDocument = LayerDocumentBase<
  "unknown",
  UnknownLayerData
>;

export type LayerDocument =
  | PsdLayerDocument
  | DrawingLayerDocument
  | TextLayerDocument
  | AudioLayerDocument
  | VideoLayerDocument
  | ShapeLayerDocument
  | GroupLayerDocument
  | UnknownLayerDocument;

export interface LayerDocumentProjectMetadata {
  schemaVersion: typeof LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION;
  projectId: string;
  name: string;
}

export interface LayerDocumentProjectPayload {
  layerDocumentsById: Record<string, LayerDocument>;
  sourceRegistry: SourceRegistry;
}

export interface LayerDocumentProject {
  metadata: LayerDocumentProjectMetadata;
  payload: LayerDocumentProjectPayload;
}
