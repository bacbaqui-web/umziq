import { useCallback } from "react";
import type { AnimatableProperty, PropertyTrackState } from "@/models";
import type { PropertiesAnimationCommandPort } from "@/engines/properties/models/propertiesInternalModel";

type Options = {
  propertyState: PropertyTrackState;
  scaleLinked: boolean;
  animation: PropertiesAnimationCommandPort;
};

export function usePropertiesTrackController(options: Options) {
  const togglePropertyTrack = useCallback((property: AnimatableProperty, enabled: boolean) => {
    if (options.propertyState[property] === enabled) return;
    options.animation.setPropertyTrackEnabled(property, enabled);
  }, [options]);

  const toggleScaleLink = useCallback(() => {
    options.animation.setScaleLinked(!options.scaleLinked);
  }, [options]);

  return { togglePropertyTrack, toggleScaleLink };
}
