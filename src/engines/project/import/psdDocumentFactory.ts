import {
  createPropertyTrackState as buildPropertyTrackState,
  type Composition,
  type CompositionMeta,
} from "@/models";
import {
  DEFAULT_DURATION_FRAMES,
  DEFAULT_FRAME_RATE,
} from "@/engines/project/constants/projectConstants";

// Compatibility exports for legacy Project imports.
export { DEFAULT_DURATION_FRAMES, DEFAULT_FRAME_RATE };

export function createMeta(fileName: string, width: number, height: number, layerCount: number): CompositionMeta {
  return {
    width,
    height,
    layerCount,
    sourceFileName: fileName,
    frameRate: DEFAULT_FRAME_RATE,
    durationFrames: DEFAULT_DURATION_FRAMES,
  };
}

export function createBaseComposition(
  params: Pick<Composition, "id" | "name" | "type" | "layers" | "children"> & {
    parentId?: string;
    sourcePath?: string;
    sourceIdentity?: Composition["sourceIdentity"];
    importSettings?: Composition["importSettings"];
    sourceFingerprint?: string;
    sourceSyncStatus?: Composition["sourceSyncStatus"];
    width: number;
    height: number;
  }
): Composition {
  return {
    id: params.id,
    name: params.name,
    type: params.type,
    parentId: params.parentId,
    sourcePath: params.sourcePath,
    sourceIdentity: params.sourceIdentity,
    importSettings: params.importSettings,
    sourceFingerprint: params.sourceFingerprint,
    sourceSyncStatus: params.sourceSyncStatus ?? "normal",
    children: params.children,
    layers: params.layers,
    position: {
      x: params.width / 2,
      y: params.height / 2,
    },
    positionKeyframes: [],
    transformOffset: {
      x: 0,
      y: 0,
    },
    anchor: {
      x: params.width / 2,
      y: params.height / 2,
    },
    scale: {
      x: 100,
      y: 100,
    },
    scaleKeyframes: [],
    scaleLinked: true,
    rotation: 0,
    rotationKeyframes: [],
    opacity: 100,
    opacityKeyframes: [],
    enabledProperties: buildPropertyTrackState(),
    modifiers: [],
  };
}
