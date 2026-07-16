import type {
  Composition,
  CompositionMeta,
  OpacityKeyframe,
  Position,
  PropertyTrackState,
  RotationKeyframe,
  Scale,
  ScaleKeyframe,
  TimelineItem,
  TimelineSelection,
} from "@/models";
import {
  buildMasterComposition,
  buildMasterMeta,
  buildMasterTimelineItems,
  collectCompositionsById,
  collectLayersById,
  findCompositionById,
  findMainComp,
} from "@/engines/project/helpers/projectModelHelpers";

export type UseProjectSelectionModelOptions = {
  masterCompId: string;
  masterWidth: number;
  masterHeight: number;
  defaultFrameRate: number;
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

export function useProjectSelectionModel(options: UseProjectSelectionModelOptions) {
  const masterTimelineItems = buildMasterTimelineItems(
    options.comps,
    options.timelineItemsByCompId[options.masterCompId] ?? [],
    options.metaByCompId,
    { masterCompId: options.masterCompId }
  );
  const masterComp = {
    ...buildMasterComposition(options.comps, options.masterEnabledProperties, {
      masterCompId: options.masterCompId,
      masterWidth: options.masterWidth,
      masterHeight: options.masterHeight,
    }),
    anchor: options.masterAnchor,
    scale: options.masterScale,
    scaleKeyframes: options.masterScaleKeyframes,
    scaleLinked: options.masterScaleLinked,
    rotation: options.masterRotation,
    rotationKeyframes: options.masterRotationKeyframes,
    opacity: options.masterOpacity,
    opacityKeyframes: options.masterOpacityKeyframes,
  };
  const rootComps = [masterComp];
  const selectedComp = findCompositionById(rootComps, options.selectedCompId) ?? masterComp;
  const allLayersById = collectLayersById(options.comps);
  const allCompositionsById = collectCompositionsById(rootComps);
  const selectedMainComp = findMainComp(rootComps, selectedComp);
  const selectedLayer = options.selectedLayerId
    ? allLayersById.get(options.selectedLayerId) ?? null
    : null;
  const selectedTimelineComp = options.selectedTimelineTarget?.kind === "subComp"
    ? findCompositionById(rootComps, options.selectedTimelineTarget.sourceId)
    : null;
  const selectedTransformTarget = selectedLayer
    ? { kind: "layer" as const, layer: selectedLayer }
    : selectedTimelineComp
      ? { kind: "composition" as const, composition: selectedTimelineComp }
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
  const selectedScaleLinked = selectedScaleTarget?.scaleLinked ?? true;
  const selectedCompMeta = selectedComp.id === options.masterCompId
    ? buildMasterMeta(options.comps, masterTimelineItems, options.metaByCompId, {
        masterCompId: options.masterCompId,
        defaultFrameRate: options.defaultFrameRate,
        masterWidth: options.masterWidth,
        masterHeight: options.masterHeight,
      })
    : options.metaByCompId[selectedComp.id] ?? null;
  const selectedMeta = selectedCompMeta
    || (selectedMainComp && options.metaByCompId[selectedMainComp.id])
    || null;
  const selectedTimelineItems = (selectedComp.id === options.masterCompId
    ? masterTimelineItems
    : options.timelineItemsByCompId[selectedComp.id]) ?? [];
  const propertiesTransformTarget = selectedTransformTarget
    ?? (selectedComp.id === options.masterCompId
      ? { kind: "composition" as const, composition: selectedComp }
      : null);
  const propertiesScaleTarget = selectedScaleTarget
    ?? (selectedComp.id === options.masterCompId ? selectedComp : null);

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
    propertiesTransformTarget,
    propertiesScaleTarget,
    propertiesScaleLinked: propertiesScaleTarget?.scaleLinked ?? selectedScaleLinked,
    selectedMeta,
    selectedTimelineItems,
  };
}
