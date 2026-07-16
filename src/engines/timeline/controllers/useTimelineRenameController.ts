import { useCallback, useState } from "react";
import type { TimelineItem } from "@/models";
import type { ProjectCommands } from "@/engines/project";
import { normalizeTimelineItemName } from "@/engines/timeline/helpers/timelineInteractionHelpers";

type Options = { compId: string; items: TimelineItem[]; projectCommands: ProjectCommands; historyPush: (id: string) => void };

export function useTimelineRenameController(options: Options) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const begin = useCallback((item: TimelineItem) => { setEditingItemId(item.id); setDraftName(item.name); }, []);
  const cancel = useCallback(() => { setEditingItemId(null); setDraftName(""); }, []);
  const commit = useCallback(() => {
    if (!editingItemId) return;
    const name = normalizeTimelineItemName(draftName);
    const item = options.items.find((candidate) => candidate.id === editingItemId);
    if (name && item && name !== item.name) {
      options.historyPush(options.compId);
      options.projectCommands.updateTimelineItem(options.compId, editingItemId, (current) => ({ ...current, name }));
    }
    setEditingItemId(null);
    setDraftName("");
  }, [draftName, editingItemId, options]);
  const handleKey = useCallback((key: string) => {
    if (key === "Enter") commit();
    else if (key === "Escape") cancel();
  }, [cancel, commit]);
  return { editingItemId, draftName, begin, setDraftName, commit, cancel, handleKey };
}
