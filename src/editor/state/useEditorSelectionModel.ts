import type {
  AnimatableProperty,
  Composition,
  CompositionMeta,
  OpacityKeyframe,
  Position,
  PropertyTrackState,
  RotationKeyframe,
  Scale,
  ScaleKeyframe,
  TimelineItem,
} from "@/editor/types/types";
import type { TimelineRow, TimelineSelection } from "@/editor/types/editorViewTypes";
import type { TransformTargetSelection } from "@/editor/types/transformActionTypes";
import {
  buildMasterComposition,
  buildMasterMeta,
  buildMasterTimelineItems,
  collectCompositionsById,
  collectLayersById,
  findCompositionById,
  findMainComp,
} from "@/editor/models/projectModelHelpers";

type UseEditorSelectionModelOptions = {
  masterCompId: string;
  masterWidth: number;
  masterHeight: number;
  defaultFrameRate: number;
  animatableProperties: AnimatableProperty[];
  comps: Composition[];
  masterEnabledProperties: PropertyTrackState;
  masterAnchor: Position;
  masterScale: Scale;
  masterScaleKeyframes: ScaleKeyframe[];
  masterScaleLinked: boolean;
  masterRotation: number;
  masterRotationKeyframes: RotationKeyframe[];
  masterOpacity: number;
  masterOpacityKeyframes: OpacityKeyframe[];
  selectedCompId: string;
  selectedLayerId: string | null;
  selectedTimelineTarget: TimelineSelection;
  metaByCompId: Record<string, CompositionMeta>;
  timelineItemsByCompId: Record<string, TimelineItem[]>;
};

export function useEditorSelectionModel({
  masterCompId,
  masterWidth,
  masterHeight,
  defaultFrameRate,
  animatableProperties,
  comps,
  masterEnabledProperties,
  masterAnchor,
  masterScale,
  masterScaleKeyframes,
  masterScaleLinked,
  masterRotation,
  masterRotationKeyframes,
  masterOpacity,
  masterOpacityKeyframes,
  selectedCompId,
  selectedLayerId,
  selectedTimelineTarget,
  metaByCompId,
  timelineItemsByCompId,
}: UseEditorSelectionModelOptions) {
  const masterTimelineItems = buildMasterTimelineItems(
    comps,
    timelineItemsByCompId[masterCompId] ?? [],
    metaByCompId,
    { masterCompId }
  );
  const masterComp = {
    ...buildMasterComposition(comps, masterEnabledProperties, {
      masterCompId,
      masterWidth,
      masterHeight,
    }),
    anchor: masterAnchor,
    scale: masterScale,
    scaleKeyframes: masterScaleKeyframes,
    scaleLinked: masterScaleLinked,
    rotation: masterRotation,
    rotationKeyframes: masterRotationKeyframes,
    opacity: masterOpacity,
    opacityKeyframes: masterOpacityKeyframes,
  };
  const rootComps = [masterComp];
  const selectedComp = findCompositionById(rootComps, selectedCompId) ?? masterComp;
  const allLayersById = collectLayersById(comps);
  const allCompositionsById = collectCompositionsById(rootComps);
  const selectedMainComp = findMainComp(rootComps, selectedComp);
  const selectedLayer = selectedLayerId ? allLayersById.get(selectedLayerId) ?? null : null;
  const selectedTimelineComp =
    selectedTimelineTarget?.kind === "subComp"
      ? findCompositionById(rootComps, selectedTimelineTarget.sourceId)
      : null;
  const selectedTransformTarget: TransformTargetSelection = selectedLayer
    ? { kind: "layer", layer: selectedLayer }
    : selectedTimelineComp
      ? { kind: "composition", composition: selectedTimelineComp }
      : null;
  const selectedPropertyTarget = selectedLayer ?? selectedTimelineComp ?? selectedComp;
  const selectedPropertyState = selectedLayer
    ? selectedLayer.enabledProperties
    : selectedTimelineComp?.enabledProperties ?? selectedComp.enabledProperties;
  const selectedScaleTarget = selectedTransformTarget?.kind === "layer"
    ? selectedTransformTarget.layer
    : selectedTransformTarget?.kind === "composition"
      ? selectedTransformTarget.composition
      : null;
  const selectedScaleLinked = selectedScaleTarget ? selectedScaleTarget.scaleLinked : true;
  const selectedCompMeta =
    selectedComp.id === masterCompId
      ? buildMasterMeta(comps, masterTimelineItems, metaByCompId, {
          masterCompId,
          defaultFrameRate,
          masterWidth,
          masterHeight,
        })
      : metaByCompId[selectedComp.id] ?? null;
  const selectedMeta =
    selectedCompMeta || (selectedMainComp && metaByCompId[selectedMainComp.id]) || null;
  const selectedTimelineItems =
    (selectedComp.id === masterCompId
      ? masterTimelineItems
      : timelineItemsByCompId[selectedComp.id]) ?? [];
  const displayedTimelineRows: TimelineRow[] = selectedTimelineItems.flatMap((item) => {
    const rows: TimelineRow[] = [{ type: "item", item }];
    const isSelectedTimelineRow =
      (selectedTimelineTarget?.itemId
        ? selectedTimelineTarget.itemId === item.id
        : selectedTimelineTarget?.sourceId === item.sourceId) &&
      selectedTimelineTarget?.kind === item.kind;

    if (!isSelectedTimelineRow) {
      return rows;
    }

    const propertyState =
      item.kind === "layer"
        ? allLayersById.get(item.sourceId)?.enabledProperties
        : findCompositionById(rootComps, item.sourceId)?.enabledProperties;

    if (!propertyState) {
      return rows;
    }

    return [
      ...rows,
      ...animatableProperties
        .filter((property) => propertyState[property])
        .map((property) => ({
          type: "property" as const,
          item,
          property,
        })),
    ];
  });

  return {
    masterTimelineItems,
    masterComp,
    rootComps,
    selectedComp,
    allLayersById,
    allCompositionsById,
    selectedMainComp,
    selectedLayer,
    selectedTimelineComp,
    selectedTransformTarget,
    selectedPropertyTarget,
    selectedPropertyState,
    selectedScaleTarget,
    selectedScaleLinked,
    selectedMeta,
    selectedTimelineItems,
    displayedTimelineRows,
  };
}
