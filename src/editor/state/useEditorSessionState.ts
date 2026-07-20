import { useState } from "react";
import type { Position, Scale } from "@/models";
import type { SelectedKeyframe } from "@/engines/animation";
import type { DraftTransformSnapshot } from "@/engines/canvas";
import { MASTER_COMP_ID } from "@/engines/project";
import type { TimelineSelection } from "@/engines/timeline";

function isSameTimelineSelection(a: TimelineSelection, b: TimelineSelection) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.itemId === b.itemId && a.sourceId === b.sourceId && a.kind === b.kind;
}

export function useEditorSessionState() {
  const [selectedCompId, setSelectedCompId] = useState<string>(MASTER_COMP_ID);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedTimelineTarget, setSelectedTimelineTarget] =
    useState<TimelineSelection>(null);
  const [lastSelectedItemByCompId, setLastSelectedItemByCompId] = useState<
    Record<string, NonNullable<TimelineSelection>>
  >({});
  const [selectedKeyframe, setSelectedKeyframe] = useState<SelectedKeyframe>(null);
  const [positionDraft, setPositionDraft] = useState<Position | null>(null);
  const [scaleDraft, setScaleDraft] = useState<Scale | null>(null);
  const [rotationDraft, setRotationDraft] = useState<number | null>(null);
  const [opacityDraft, setOpacityDraft] = useState<number | null>(null);
  const [draftTransformSnapshot, setDraftTransformSnapshot] =
    useState<DraftTransformSnapshot | null>(null);
  const [propertiesInputDrafts, setPropertiesInputDrafts] = useState<Record<string, string>>({});
  const [propertiesInputDraftScope, setPropertiesInputDraftScope] = useState<string | null>(null);
  const [focusedPropertiesInputId, setFocusedPropertiesInputId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const rememberSelectedItem = (
    compId: string,
    nextSelection: NonNullable<TimelineSelection>
  ) => {
    setLastSelectedItemByCompId((current) => {
      if (isSameTimelineSelection(current[compId] ?? null, nextSelection)) return current;
      return { ...current, [compId]: nextSelection };
    });
  };

  const applySelectionForComposition = (
    compId: string,
    nextSelection: TimelineSelection
  ) => {
    setSelectedTimelineTarget(nextSelection);
    setSelectedLayerId(nextSelection?.kind === "layer" ? nextSelection.sourceId : null);
    setSelectedKeyframe(null);
    setPositionDraft(null);
    setScaleDraft(null);
    setRotationDraft(null);
    setOpacityDraft(null);
    if (nextSelection) rememberSelectedItem(compId, nextSelection);
  };

  return {
    selectedCompId,
    setSelectedCompId,
    selectedLayerId,
    setSelectedLayerId,
    selectedTimelineTarget,
    setSelectedTimelineTarget,
    lastSelectedItemByCompId,
    setLastSelectedItemByCompId,
    selectedKeyframe,
    setSelectedKeyframe,
    positionDraft,
    setPositionDraft,
    scaleDraft,
    setScaleDraft,
    rotationDraft,
    setRotationDraft,
    opacityDraft,
    setOpacityDraft,
    draftTransformSnapshot,
    setDraftTransformSnapshot,
    propertiesInputDrafts,
    setPropertiesInputDrafts,
    propertiesInputDraftScope,
    setPropertiesInputDraftScope,
    focusedPropertiesInputId,
    setFocusedPropertiesInputId,
    importError,
    setImportError,
    importNotice,
    setImportNotice,
    applySelectionForComposition,
  };
}
