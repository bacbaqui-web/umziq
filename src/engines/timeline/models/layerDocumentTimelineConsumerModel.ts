import type {
  LayerDocumentTimelineSourceReadModel,
  LayerDocumentType,
} from "@/models";

export interface LayerDocumentTimelineConsumerRow {
  readonly layerDocumentId: string;
  readonly parentLayerDocumentId: string | null;
  readonly depth: number;
  readonly order: number;
  readonly name: string;
  readonly alias: string | null;
  readonly label: string;
  readonly type: LayerDocumentType;
  readonly sourceId: string | null;
  readonly source:
    (
      LayerDocumentTimelineSourceReadModel & {
        readonly resolutionStatus:
          | "unresolved"
          | "resolving"
          | "available"
          | "missing"
          | "error";
      }
    ) | null;
  readonly startFrame: number;
  readonly durationFrames: number;
  readonly sourceOffsetFrames: number;
  readonly visible: boolean;
  readonly children:
    readonly LayerDocumentTimelineConsumerRow[];
}

export type LayerDocumentTimelineConsumerRowsResult =
  | {
      readonly available: true;
      readonly rows:
        readonly LayerDocumentTimelineConsumerRow[];
    }
  | {
      readonly available: false;
      readonly rows: readonly [];
    };
