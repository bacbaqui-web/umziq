import type {
  Composition,
  CompositionMeta,
  Layer,
  SourceSyncStatus,
} from "@/models/offlineMigration/compositionModel";
import {
  PROJECT_SOURCE_SCHEMA_VERSION,
  PROJECT_SOURCE_VERSION,
  type GroupSource,
  type ProjectSource,
  type ProjectSourceAnimation,
  type ProjectSourceDocument,
  type ProjectSourceTransform,
  type PsdLayerSource,
  type SourceAvailability,
} from "@/models/offlineMigration/projectSourceModel";
import type {
  TimelineItem,
  TimelineItemReference,
} from "@/models/offlineMigration/timelineItemModel";

export interface LegacyProjectSourceInput {
  compositions: Composition[];
  virtualRootComposition?: Composition;
  timelineItemsByCompId: Record<string, TimelineItem[]>;
  metaByCompId: Record<string, CompositionMeta>;
}

function clonePosition(position: { x: number; y: number }) {
  return { x: position.x, y: position.y };
}

function cloneTransform(source: Layer | Composition): ProjectSourceTransform {
  return {
    position: clonePosition(source.position),
    transformOffset: clonePosition(source.transformOffset),
    anchor: clonePosition(source.anchor),
    scale: clonePosition(source.scale),
    scaleLinked: source.scaleLinked,
    rotation: source.rotation,
    opacity: source.opacity,
  };
}

function cloneAnimation(source: Layer | Composition): ProjectSourceAnimation {
  return {
    positionKeyframes: source.positionKeyframes.map((keyframe) => ({
      frame: keyframe.frame,
      value: clonePosition(keyframe.value),
    })),
    scaleKeyframes: source.scaleKeyframes.map((keyframe) => ({
      frame: keyframe.frame,
      value: clonePosition(keyframe.value),
    })),
    rotationKeyframes: source.rotationKeyframes.map((keyframe) => ({
      frame: keyframe.frame,
      value: keyframe.value,
    })),
    opacityKeyframes: source.opacityKeyframes.map((keyframe) => ({
      frame: keyframe.frame,
      value: keyframe.value,
    })),
    enabledProperties: { ...source.enabledProperties },
  };
}

function cloneModifiers(source: Layer | Composition) {
  return source.modifiers.map((modifier) => ({ ...modifier }));
}

function resolveAvailability(
  syncStatus: SourceSyncStatus | undefined
): SourceAvailability {
  return syncStatus === "missing" ? "missing" : "available";
}

function normalizePsdLayer(layer: Layer): PsdLayerSource {
  const syncStatus = layer.sourceSyncStatus ?? "normal";
  return {
    sourceId: layer.id,
    type: "psd",
    name: layer.name,
    availability: resolveAvailability(syncStatus),
    syncStatus,
    sourceVersion: PROJECT_SOURCE_VERSION,
    transform: cloneTransform(layer),
    animation: cloneAnimation(layer),
    modifiers: cloneModifiers(layer),
    effects: [],
    content: {
      sourceIdentity: layer.sourceIdentity
        ? { ...layer.sourceIdentity }
        : null,
      sourcePath: layer.sourcePath ?? null,
      sourceFingerprint: layer.sourceFingerprint ?? null,
    },
  };
}

function normalizeGroup(composition: Composition): GroupSource {
  const syncStatus = composition.sourceSyncStatus ?? "normal";
  return {
    sourceId: composition.id,
    type: "group",
    name: composition.name,
    availability: resolveAvailability(syncStatus),
    syncStatus,
    sourceVersion: PROJECT_SOURCE_VERSION,
    transform: cloneTransform(composition),
    animation: cloneAnimation(composition),
    modifiers: cloneModifiers(composition),
    effects: [],
    content: {
      timelineId: composition.id,
      legacyCompositionType: composition.type,
      sourceIdentity: composition.sourceIdentity
        ? { ...composition.sourceIdentity }
        : null,
      sourcePath: composition.sourcePath ?? null,
      sourceFingerprint: composition.sourceFingerprint ?? null,
      importSettings: composition.importSettings
        ? { ...composition.importSettings }
        : null,
    },
  };
}

function normalizeTimelineItem(
  item: TimelineItem,
  source: ProjectSource | undefined
): TimelineItemReference {
  return {
    itemId: item.id,
    sourceId: item.sourceId,
    groupId: item.compId,
    alias: source && source.name === item.name ? null : item.name,
    visible: item.visible,
    startFrame: item.startFrame,
    durationFrames: item.durationFrames,
    sourceOffsetFrames: item.sourceOffsetFrames ?? 0,
  };
}

export function normalizeLegacyProjectSources(
  input: LegacyProjectSourceInput
): ProjectSourceDocument {
  const sourcesById: Record<string, ProjectSource> = {};
  const compositionIds = new Set<string>();
  const rootSourceIds: string[] = [];
  const visiting = new Set<Composition>();

  const visitComposition = (composition: Composition) => {
    if (visiting.has(composition) || compositionIds.has(composition.id)) return;
    if (sourcesById[composition.id]) {
      throw new Error(`Duplicate legacy source id: ${composition.id}`);
    }
    visiting.add(composition);
    compositionIds.add(composition.id);
    sourcesById[composition.id] = normalizeGroup(composition);
    composition.layers.forEach((layer) => {
      if (sourcesById[layer.id]) {
        throw new Error(`Duplicate legacy source id: ${layer.id}`);
      }
      sourcesById[layer.id] = normalizePsdLayer(layer);
    });
    composition.children?.forEach(visitComposition);
    visiting.delete(composition);
  };

  const entryCompositions = input.virtualRootComposition
    ? [input.virtualRootComposition]
    : input.compositions;
  entryCompositions.forEach(visitComposition);

  const knownCompositionIds = new Set(compositionIds);
  entryCompositions.forEach((composition) => {
    if (
      !composition.parentId ||
      !knownCompositionIds.has(composition.parentId)
    ) {
      rootSourceIds.push(composition.id);
    }
  });

  const timelineItemsByGroupId = Object.fromEntries(
    Object.entries(input.timelineItemsByCompId).map(([groupId, items]) => {
      if (!compositionIds.has(groupId)) {
        throw new Error(`Legacy Timeline nexus is not a Composition: ${groupId}`);
      }
      return [
        groupId,
        items.map((item) =>
          normalizeTimelineItem(item, sourcesById[item.sourceId])
        ),
      ];
    })
  );

  compositionIds.forEach((compositionId) => {
    timelineItemsByGroupId[compositionId] ??= [];
  });

  const compositionMetaByGroupId = Object.fromEntries(
    Object.entries(input.metaByCompId)
      .filter(([groupId]) => compositionIds.has(groupId))
      .map(([groupId, meta]) => [groupId, { ...meta }])
  );

  return {
    schemaVersion: PROJECT_SOURCE_SCHEMA_VERSION,
    sourcesById,
    rootSourceIds,
    timelineItemsByGroupId,
    compositionMetaByGroupId,
  };
}
