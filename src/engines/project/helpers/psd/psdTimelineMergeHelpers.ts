import type { Composition, Layer, TimelineItem } from "@/models";
import type {
  PsdDirectSourceDescriptor,
  PsdSourceEntity,
} from "@/engines/project/models/psdRefreshResultModel";
import {
  buildChildPathById,
  buildLayerPathById,
} from "@/engines/project/helpers/psd/psdSourceMatchingHelpers";

export function buildTimelineTemplateMap(
  timelineItems: TimelineItem[],
  directLayers: Layer[],
  directChildren: Composition[]
) {
  const layerPathById = buildLayerPathById(directLayers);
  const childPathById = buildChildPathById(directChildren);
  const templates = new Map<string, TimelineItem>();

  timelineItems.forEach((item) => {
    const sourcePath =
      item.kind === "layer"
        ? layerPathById.get(item.sourceId)
        : childPathById.get(item.sourceId);
    if (!sourcePath) return;
    const key = `${item.kind}:${sourcePath}`;
    if (!templates.has(key)) templates.set(key, item);
  });

  return templates;
}

export function patchNewTimelineItemSource(
  item: TimelineItem,
  entity: PsdSourceEntity
): TimelineItem {
  return "children" in entity
    ? { ...item, sourceId: entity.id, targetCompId: entity.id, name: entity.name }
    : { ...item, sourceId: entity.id, name: entity.name };
}

export function updateDirectTimelineItem(
  item: TimelineItem,
  descriptor: PsdDirectSourceDescriptor
): TimelineItem {
  if (descriptor.isMissingSource) return item;
  if (item.kind === "subComp" && "children" in descriptor.entity) {
    return {
      ...item,
      name: descriptor.nextName,
      visible: descriptor.nextVisible,
      sourceId: descriptor.entity.id,
      targetCompId: descriptor.entity.id,
    };
  }
  return {
    ...item,
    name: descriptor.nextName,
    visible: descriptor.nextVisible,
    sourceId: descriptor.entity.id,
  };
}
