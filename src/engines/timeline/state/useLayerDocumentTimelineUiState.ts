import { useState } from "react";
import type {
  LayerDocumentTimelineKeyframeDrag,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";

export function useLayerDocumentTimelineUiState(
  initialNameColumnWidth: number
) {
  const [hoveredFrame, setHoveredFrame] =
    useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [nameColumnWidth, setNameColumnWidth] =
    useState(initialNameColumnWidth);
  const [draggedLayerDocumentId, setDraggedLayerDocumentId] =
    useState<string | null>(null);
  const [editingLayerDocumentId, setEditingLayerDocumentId] =
    useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deleteDecisionLayerDocumentId, setDeleteDecisionLayerDocumentId] =
    useState<string | null>(null);
  const [expandedLayerDocumentIds, setExpandedLayerDocumentIds] =
    useState<ReadonlySet<string>>(() => new Set());
  const [keyframeDrag, setKeyframeDrag] =
    useState<LayerDocumentTimelineKeyframeDrag | null>(null);

  return {
    hoveredFrame,
    setHoveredFrame,
    isScrubbing,
    setIsScrubbing,
    isSwitcherOpen,
    setIsSwitcherOpen,
    nameColumnWidth,
    setNameColumnWidth,
    draggedLayerDocumentId,
    setDraggedLayerDocumentId,
    editingLayerDocumentId,
    setEditingLayerDocumentId,
    draftName,
    setDraftName,
    deleteDecisionLayerDocumentId,
    setDeleteDecisionLayerDocumentId,
    expandedLayerDocumentIds,
    setExpandedLayerDocumentIds,
    keyframeDrag,
    setKeyframeDrag,
  };
}
