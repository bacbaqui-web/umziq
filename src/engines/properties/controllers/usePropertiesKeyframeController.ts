import { useCallback } from "react";
import type { PropertiesAnimationCommandPort } from "@/engines/properties/models/propertiesInternalModel";

export function usePropertiesKeyframeController(animation: PropertiesAnimationCommandPort) {
  const savePositionKeyframe = useCallback(() => {
    animation.savePositionKeyframe();
  }, [animation]);

  const deleteSelectedKeyframe = useCallback(() => {
    animation.removeSelectedKeyframe();
  }, [animation]);

  return { savePositionKeyframe, deleteSelectedKeyframe };
}
