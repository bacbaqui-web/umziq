import { useCallback } from "react";
import type { CompositionMeta } from "@/models";
import type { PlaybackCommands } from "@/engines/playback-render";
import type { ProjectCommands } from "@/engines/project";

type Options = {
  compId: string;
  selectedMeta: CompositionMeta | null;
  projectCommands: ProjectCommands;
  playbackCommands: PlaybackCommands;
  pushHistory: (compId: string) => void;
};

export function useTimelineDurationController(options: Options) {
  const update = useCallback((durationFrames: number) => {
    if (!options.selectedMeta) return;
    const nextDurationFrames = Math.max(1, durationFrames);
    if (nextDurationFrames === options.selectedMeta.durationFrames) return;
    options.pushHistory(options.compId);
    options.projectCommands.updateCompositionMeta((current) => ({
      ...current,
      [options.compId]: { ...options.selectedMeta!, durationFrames: nextDurationFrames },
    }));
    options.playbackCommands.normalizeForDuration(nextDurationFrames);
  }, [options]);

  return { update };
}
