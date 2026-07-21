import { useRef } from "react";
import type {
  Composition,
  CompositionMeta,
  Layer,
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

function createMemoizedDerivation<Value>() {
  let previousDependencies: readonly unknown[] | null = null;
  let previousValue: Value;
  return (dependencies: readonly unknown[], derive: () => Value): Value => {
    const unchanged = previousDependencies?.length === dependencies.length
      && dependencies.every((dependency, index) =>
        Object.is(dependency, previousDependencies?.[index])
      );
    if (unchanged) return previousValue;
    previousDependencies = dependencies;
    previousValue = derive();
    return previousValue;
  };
}

export function createProjectSelectionModelDeriver() {
  const emptyTimelineItems: TimelineItem[] = [];
  const deriveMasterTimelineItems = createMemoizedDerivation<TimelineItem[]>();
  const deriveMasterComp = createMemoizedDerivation<Composition>();
  const deriveRootComps = createMemoizedDerivation<Composition[]>();
  const deriveAllLayersById = createMemoizedDerivation<Map<string, Layer>>();
  const deriveAllCompositionsById = createMemoizedDerivation<Map<string, Composition>>();
  const deriveSelectedComp = createMemoizedDerivation<Composition>();
  const deriveSelectedMainComp = createMemoizedDerivation<Composition | null>();
  const deriveSelectedLayer = createMemoizedDerivation<Layer | null>();
  const deriveSelectedTimelineComp = createMemoizedDerivation<Composition | null>();
  const deriveSelectedTransformTarget = createMemoizedDerivation<
    | { kind: "layer"; layer: Layer }
    | { kind: "composition"; composition: Composition }
    | null
  >();
  const deriveSelectedPropertyTarget = createMemoizedDerivation<
    Layer | Composition
  >();
  const deriveMasterMeta = createMemoizedDerivation<CompositionMeta>();
  const derivePropertiesTransformTarget = createMemoizedDerivation<
    | { kind: "layer"; layer: Layer }
    | { kind: "composition"; composition: Composition }
    | null
  >();
  const deriveResult = createMemoizedDerivation<{
    masterTimelineItems: TimelineItem[];
    masterComp: Composition;
    rootComps: Composition[];
    selectedComp: Composition;
    allLayersById: Map<string, Layer>;
    allCompositionsById: Map<string, Composition>;
    selectedMainComp: Composition | null;
    selectedLayer: Layer | null;
    selectedTimelineComp: Composition | null;
    selectedTransformTarget: ReturnType<typeof deriveSelectedTransformTarget>;
    selectedPropertyTarget: Layer | Composition;
    selectedPropertyState: PropertyTrackState;
    selectedScaleTarget: Layer | Composition | null;
    selectedScaleLinked: boolean;
    propertiesTransformTarget: ReturnType<typeof derivePropertiesTransformTarget>;
    propertiesScaleTarget: Layer | Composition | null;
    propertiesScaleLinked: boolean;
    selectedMeta: CompositionMeta | null;
    selectedTimelineItems: TimelineItem[];
  }>();

  return {
    derive: (options: UseProjectSelectionModelOptions) => {
      const existingMasterTimelineItems =
        options.timelineItemsByCompId[options.masterCompId];
      const masterTimelineItems = deriveMasterTimelineItems(
        [
          options.comps,
          existingMasterTimelineItems,
          options.metaByCompId,
          options.masterCompId,
        ],
        () => buildMasterTimelineItems(
          options.comps,
          existingMasterTimelineItems ?? [],
          options.metaByCompId,
          { masterCompId: options.masterCompId }
        )
      );
      const masterComp = deriveMasterComp(
        [
          options.comps,
          options.masterEnabledProperties,
          options.masterCompId,
          options.masterWidth,
          options.masterHeight,
          options.masterAnchor,
          options.masterScale,
          options.masterScaleKeyframes,
          options.masterScaleLinked,
          options.masterRotation,
          options.masterRotationKeyframes,
          options.masterOpacity,
          options.masterOpacityKeyframes,
        ],
        () => ({
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
        })
      );
      const rootComps = deriveRootComps([masterComp], () => [masterComp]);
      const allLayersById = deriveAllLayersById(
        [options.comps],
        () => collectLayersById(options.comps)
      );
      const allCompositionsById = deriveAllCompositionsById(
        [rootComps],
        () => collectCompositionsById(rootComps)
      );
      const selectedComp = deriveSelectedComp(
        [rootComps, options.selectedCompId],
        () => findCompositionById(rootComps, options.selectedCompId) ?? masterComp
      );
      const selectedMainComp = deriveSelectedMainComp(
        [rootComps, selectedComp],
        () => findMainComp(rootComps, selectedComp)
      );
      const selectedLayer = deriveSelectedLayer(
        [allLayersById, options.selectedLayerId],
        () => options.selectedLayerId
          ? allLayersById.get(options.selectedLayerId) ?? null
          : null
      );
      const selectedTimelineKind = options.selectedTimelineTarget?.kind ?? null;
      const selectedTimelineSourceId = options.selectedTimelineTarget?.sourceId ?? null;
      const selectedTimelineComp = deriveSelectedTimelineComp(
        [rootComps, selectedTimelineKind, selectedTimelineSourceId],
        () => selectedTimelineKind === "subComp" && selectedTimelineSourceId
          ? findCompositionById(rootComps, selectedTimelineSourceId)
          : null
      );
      const selectedTransformTarget = deriveSelectedTransformTarget(
        [selectedLayer, selectedTimelineComp],
        () => selectedLayer
          ? { kind: "layer", layer: selectedLayer }
          : selectedTimelineComp
            ? { kind: "composition", composition: selectedTimelineComp }
            : null
      );
      const selectedPropertyTarget = deriveSelectedPropertyTarget(
        [selectedLayer, selectedTimelineComp, selectedComp],
        () => selectedLayer ?? selectedTimelineComp ?? selectedComp
      );
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
        ? deriveMasterMeta(
            [
              options.comps,
              masterTimelineItems,
              options.metaByCompId,
              options.masterCompId,
              options.defaultFrameRate,
              options.masterWidth,
              options.masterHeight,
            ],
            () => buildMasterMeta(
              options.comps,
              masterTimelineItems,
              options.metaByCompId,
              {
                masterCompId: options.masterCompId,
                defaultFrameRate: options.defaultFrameRate,
                masterWidth: options.masterWidth,
                masterHeight: options.masterHeight,
              }
            )
          )
        : options.metaByCompId[selectedComp.id] ?? null;
      const selectedMeta = selectedCompMeta
        || (selectedMainComp && options.metaByCompId[selectedMainComp.id])
        || null;
      const selectedTimelineItems = (selectedComp.id === options.masterCompId
        ? masterTimelineItems
        : options.timelineItemsByCompId[selectedComp.id]) ?? emptyTimelineItems;
      const propertiesTransformTarget = derivePropertiesTransformTarget(
        [selectedTransformTarget, selectedComp, options.masterCompId],
        () => selectedTransformTarget
          ?? (selectedComp.id === options.masterCompId
            ? { kind: "composition", composition: selectedComp }
            : null)
      );
      const propertiesScaleTarget = selectedScaleTarget
        ?? (selectedComp.id === options.masterCompId ? selectedComp : null);
      const propertiesScaleLinked =
        propertiesScaleTarget?.scaleLinked ?? selectedScaleLinked;

      const values = {
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
        propertiesScaleLinked,
        selectedMeta,
        selectedTimelineItems,
      };
      return deriveResult(Object.values(values), () => values);
    },
  };
}

export function useProjectSelectionModel(options: UseProjectSelectionModelOptions) {
  const deriverRef = useRef<ReturnType<typeof createProjectSelectionModelDeriver> | null>(null);
  deriverRef.current ??= createProjectSelectionModelDeriver();
  return deriverRef.current.derive(options);
}
