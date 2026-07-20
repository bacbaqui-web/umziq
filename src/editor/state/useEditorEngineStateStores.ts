import { useRef, useState } from "react";
import {
  createPropertyTrackState,
  type Composition,
  type CompositionMeta,
  type OpacityKeyframe,
  type Position,
  type RotationKeyframe,
  type Scale,
  type ScaleKeyframe,
  type TimelineItem,
} from "@/models";
import type { SelectedKeyframe } from "@/engines/animation";
import type {
  CanvasDirectInputState,
  CanvasHoveredHandle,
  CanvasPendingHandleInteraction,
  CanvasPendingMotionPathInteraction,
  ScaleHandleDirection,
} from "@/engines/canvas";
import type { PlaybackRange, RendererMode } from "@/engines/playback-render";
import type { RenderItem, StoredPsdSource } from "@/engines/project";

export function useEditorProjectState(masterWidth: number, masterHeight: number) {
  const [comps, setComps] = useState<Composition[]>([]);
  const [masterEnabledProperties, setMasterEnabledProperties] = useState(createPropertyTrackState());
  const [masterScale, setMasterScale] = useState<Scale>({ x: 100, y: 100 });
  const [masterScaleKeyframes, setMasterScaleKeyframes] = useState<ScaleKeyframe[]>([]);
  const [masterScaleLinked, setMasterScaleLinked] = useState(true);
  const [masterRotation, setMasterRotation] = useState(0);
  const [masterRotationKeyframes, setMasterRotationKeyframes] = useState<RotationKeyframe[]>([]);
  const [masterOpacity, setMasterOpacity] = useState(100);
  const [masterOpacityKeyframes, setMasterOpacityKeyframes] = useState<OpacityKeyframe[]>([]);
  const [masterAnchor] = useState<Position>({ x: masterWidth / 2, y: masterHeight / 2 });
  const [metaByCompId, setMetaByCompId] = useState<Record<string, CompositionMeta>>({});
  const [timelineItemsByCompId, setTimelineItemsByCompId] = useState<Record<string, TimelineItem[]>>({});
  const [nextImportIndex, setNextImportIndex] = useState(0);
  const psdSourceEntriesRef = useRef<Record<string, StoredPsdSource>>({});
  const [renderItemsByCompId, setRenderItemsByCompId] = useState<Record<string, RenderItem[]>>({});

  return {
    comps, setComps, masterEnabledProperties, setMasterEnabledProperties,
    masterScale, setMasterScale, masterScaleKeyframes, setMasterScaleKeyframes,
    masterScaleLinked, setMasterScaleLinked, masterRotation, setMasterRotation,
    masterRotationKeyframes, setMasterRotationKeyframes, masterOpacity, setMasterOpacity,
    masterOpacityKeyframes, setMasterOpacityKeyframes, masterAnchor,
    metaByCompId, setMetaByCompId, timelineItemsByCompId, setTimelineItemsByCompId,
    nextImportIndex, setNextImportIndex, psdSourceEntriesRef,
    renderItemsByCompId, setRenderItemsByCompId,
  };
}

export function useEditorPlaybackState() {
  const [playbackRangeByCompId, setPlaybackRangeByCompId] = useState<Record<string, PlaybackRange>>({});
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rendererMode, setRendererMode] = useState<RendererMode>("full-render");
  return {
    playbackRangeByCompId,
    setPlaybackRangeByCompId,
    currentFrame,
    setCurrentFrame,
    isPlaying,
    setIsPlaying,
    rendererMode,
    setRendererMode,
  };
}

export function useEditorCanvasState(minWidth: number, minHeight: number) {
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState<Position>({ x: 0, y: 0 });
  const [previewWorkspaceSize, setPreviewWorkspaceSize] = useState({ width: minWidth, height: minHeight });
  const [showShortformFrameOverlay, setShowShortformFrameOverlay] = useState(true);
  const [showSafeZoneGuides, setShowSafeZoneGuides] = useState(false);
  const [isDraggingAnchor, setIsDraggingAnchor] = useState(false);
  const [isDraggingPosition, setIsDraggingPosition] = useState(false);
  const [isDraggingOpacity, setIsDraggingOpacity] = useState(false);
  const [isDraggingRotation, setIsDraggingRotation] = useState(false);
  const [isDraggingMotionPathKeyframe, setIsDraggingMotionPathKeyframe] = useState(false);
  const [isPreviewPanning, setIsPreviewPanning] = useState(false);
  const [isPreviewPanModifierActive, setIsPreviewPanModifierActive] = useState(false);
  const [rotationHandleReadout, setRotationHandleReadout] = useState<string | null>(null);
  const [opacityHandleReadout, setOpacityHandleReadout] = useState<string | null>(null);
  const [scaleHandleReadout, setScaleHandleReadout] = useState<{ handle: ScaleHandleDirection; text: string } | null>(null);
  const [positionHandleReadout, setPositionHandleReadout] = useState<string | null>(null);
  const [motionPathKeyframeReadout, setMotionPathKeyframeReadout] = useState<string | null>(null);
  const [draggingMotionPathFrame, setDraggingMotionPathFrame] = useState<number | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<CanvasHoveredHandle>(null);
  const [hoveredMotionFrame, setHoveredMotionFrame] = useState<number | null>(null);
  const [pendingHandleInteraction, setPendingHandleInteraction] = useState<CanvasPendingHandleInteraction>(null);
  const [pendingMotionPathInteraction, setPendingMotionPathInteraction] = useState<CanvasPendingMotionPathInteraction>(null);
  const [suppressedMotionPathClickFrame, setSuppressedMotionPathClickFrame] = useState<number | null>(null);
  const [isAnchorHovered, setIsAnchorHovered] = useState(false);
  const [directInput, setDirectInput] = useState<CanvasDirectInputState>(null);
  return {
    previewZoom, setPreviewZoom, previewPan, setPreviewPan, previewWorkspaceSize, setPreviewWorkspaceSize,
    showShortformFrameOverlay, setShowShortformFrameOverlay, showSafeZoneGuides, setShowSafeZoneGuides,
    isDraggingAnchor, setIsDraggingAnchor, isDraggingPosition, setIsDraggingPosition,
    isDraggingOpacity, setIsDraggingOpacity, isDraggingRotation, setIsDraggingRotation,
    isDraggingMotionPathKeyframe, setIsDraggingMotionPathKeyframe,
    isPreviewPanning, setIsPreviewPanning, isPreviewPanModifierActive, setIsPreviewPanModifierActive,
    rotationHandleReadout, setRotationHandleReadout, opacityHandleReadout, setOpacityHandleReadout,
    scaleHandleReadout, setScaleHandleReadout, positionHandleReadout, setPositionHandleReadout,
    motionPathKeyframeReadout, setMotionPathKeyframeReadout, draggingMotionPathFrame, setDraggingMotionPathFrame,
    hoveredHandle, setHoveredHandle, hoveredMotionFrame, setHoveredMotionFrame,
    pendingHandleInteraction, setPendingHandleInteraction,
    pendingMotionPathInteraction, setPendingMotionPathInteraction,
    suppressedMotionPathClickFrame, setSuppressedMotionPathClickFrame,
    isAnchorHovered, setIsAnchorHovered, directInput, setDirectInput,
  };
}

export function useEditorTimelineState() {
  const [draggedTimelineItemId, setDraggedTimelineItemId] = useState<string | null>(null);
  const [isScrubbingTimeline, setIsScrubbingTimeline] = useState(false);
  const [hoveredFrame, setHoveredFrame] = useState<number | null>(null);
  const [draggingKeyframe, setDraggingKeyframe] = useState<SelectedKeyframe>(null);
  return { draggedTimelineItemId, setDraggedTimelineItemId, isScrubbingTimeline, setIsScrubbingTimeline, hoveredFrame, setHoveredFrame, draggingKeyframe, setDraggingKeyframe };
}
