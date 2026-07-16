import { useCallback } from "react";
import type { AnimatableProperty, Composition, Layer, Position, Scale } from "@/models";
import type {
  AnimationHistoryPort,
  AnimationProjectPort,
  AnimationSessionPort,
  MasterAnimationPort,
} from "@/engines/animation/models/animationCommandModel";
import type { SelectedKeyframe } from "@/engines/animation/models/animationSessionModel";
import { clampOpacity } from "@/engines/animation/helpers/transformValueHelpers";
import {
  createSelectedPropertyKeyframe,
  matchesSelectedPropertyKeyframe,
} from "@/engines/animation/helpers/animationSelectionHelpers";
import { upsertKeyframeValue } from "@/engines/animation/helpers/keyframeTrackHelpers";
import {
  setPropertyTrackEnabledOnlyInCompositions,
  setPropertyTrackInCompositions,
  setScaleLinkedInCompositions,
} from "@/engines/animation/actions/animationProjectMutations";

type Options = {
  masterCompId: string;
  selectedComp: Composition;
  selectedLayer: Layer | null;
  selectedTimelineComp: Composition | null;
  selectedScaleTarget: Layer | Composition | null;
  selectedKeyframe: SelectedKeyframe;
  localFrame: number;
  values: { position: Position; scale: Scale; rotation: number; opacity: number };
  project: AnimationProjectPort;
  master: MasterAnimationPort;
  session: AnimationSessionPort;
  history: AnimationHistoryPort;
};

export function usePropertyTrackController(options: Options) {
  const setScaleLinked = useCallback((linked: boolean) => {
    const target = options.selectedScaleTarget;
    if (!target) return;
    if ("type" in target && target.id === options.masterCompId) {
      options.master.setScaleLinked(linked);
      return;
    }
    options.project.updateCompositions((current) =>
      setScaleLinkedInCompositions(
        current,
        { kind: "visible" in target ? "layer" : "composition", id: target.id },
        linked
      )
    );
  }, [options]);

  const setPropertyTrackEnabled = useCallback((property: AnimatableProperty, enabled: boolean) => {
    options.history.push();
    const frames = { position: options.localFrame, scale: options.localFrame, rotation: options.localFrame, opacity: options.localFrame };
    const values = { ...options.values, opacity: clampOpacity(options.values.opacity) };

    if (options.selectedLayer) {
      options.project.updateCompositions((current) =>
        setPropertyTrackInCompositions(current, { kind: "layer", id: options.selectedLayer!.id }, property, enabled, values, frames)
      );
      if (enabled) options.session.setSelectedKeyframe(createSelectedPropertyKeyframe("layer", options.selectedLayer.id, property, options.localFrame));
      else if (matchesSelectedPropertyKeyframe(options.selectedKeyframe, "layer", options.selectedLayer.id, property)) options.session.setSelectedKeyframe(null);
      return;
    }

    if (options.selectedTimelineComp) {
      if (options.selectedTimelineComp.id === options.masterCompId) {
        options.master.setEnabledProperties((current) => ({ ...current, [property]: enabled }));
        if (enabled && property === "scale") options.master.setScaleKeyframes((current) => upsertKeyframeValue(current, options.localFrame, options.values.scale));
        else if (enabled && property === "rotation") options.master.setRotationKeyframes((current) => upsertKeyframeValue(current, options.localFrame, options.values.rotation));
        else if (enabled && property === "opacity") options.master.setOpacityKeyframes((current) => upsertKeyframeValue(current, options.localFrame, options.values.opacity));
        if (enabled && property !== "position") options.session.setSelectedKeyframe(createSelectedPropertyKeyframe("composition", options.masterCompId, property, options.localFrame));
        return;
      }

      options.project.updateCompositions((current) =>
        setPropertyTrackInCompositions(current, { kind: "composition", id: options.selectedTimelineComp!.id }, property, enabled, options.values, frames)
      );
      if (enabled) options.session.setSelectedKeyframe(createSelectedPropertyKeyframe("composition", options.selectedTimelineComp.id, property, options.localFrame));
      else if (matchesSelectedPropertyKeyframe(options.selectedKeyframe, "composition", options.selectedTimelineComp.id, property)) options.session.setSelectedKeyframe(null);
      return;
    }

    if (options.selectedComp.id === options.masterCompId) {
      options.master.setEnabledProperties((current) => ({ ...current, [property]: enabled }));
      return;
    }
    options.project.updateCompositions((current) =>
      setPropertyTrackEnabledOnlyInCompositions(current, { kind: "composition", id: options.selectedComp.id }, property, enabled)
    );
  }, [options]);

  return { setScaleLinked, setPropertyTrackEnabled, handleTogglePropertyTrack: setPropertyTrackEnabled, setScaleLinkState: setScaleLinked };
}
