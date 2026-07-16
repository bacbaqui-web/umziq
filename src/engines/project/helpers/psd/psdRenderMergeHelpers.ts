import type { Composition, Layer } from "@/models";
import type { RenderDrawable, RenderItem } from "@/engines/project/models/runtimeRenderModel";
import type {
  PsdDirectSourceDescriptor,
  PsdSourceEntity,
} from "@/engines/project/models/psdRefreshResultModel";
import {
  buildChildPathById,
  buildLayerPathById,
} from "@/engines/project/helpers/psd/psdSourceMatchingHelpers";

export function clonePsdDrawables(
  drawables: RenderDrawable[],
  sourceLayerId?: string
) {
  return drawables.map((drawable) => ({
    ...drawable,
    sourceLayerId: sourceLayerId ?? drawable.sourceLayerId,
  }));
}

export function buildRenderTemplateMap(
  renderItems: RenderItem[],
  directLayers: Layer[],
  directChildren: Composition[]
) {
  const layerPathById = buildLayerPathById(directLayers);
  const childPathById = buildChildPathById(directChildren);
  const templates = new Map<string, RenderItem>();

  renderItems.forEach((item) => {
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

export function patchNewRenderItemSource(
  item: RenderItem,
  entity: PsdSourceEntity,
  drawables: RenderDrawable[]
): RenderItem {
  return "children" in entity
    ? {
        ...item,
        sourceId: entity.id,
        targetCompId: entity.id,
        name: entity.name,
        drawables,
      }
    : { ...item, sourceId: entity.id, name: entity.name, drawables };
}

export function updateDirectRenderItem(
  item: RenderItem,
  descriptor: PsdDirectSourceDescriptor
): RenderItem {
  if (descriptor.isMissingSource || !descriptor.nextDrawables) return item;
  if (item.kind === "subComp" && "children" in descriptor.entity) {
    return {
      ...item,
      name: descriptor.nextName,
      visible: descriptor.nextVisible,
      sourceId: descriptor.entity.id,
      targetCompId: descriptor.entity.id,
      drawables: descriptor.nextDrawables,
    };
  }
  return {
    ...item,
    name: descriptor.nextName,
    visible: descriptor.nextVisible,
    sourceId: descriptor.entity.id,
    drawables: descriptor.nextDrawables,
  };
}
