import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ANIMATABLE_PROPERTIES,
} from "@/animation";
import {
  createLayerDocumentPropertiesController,
  type LayerDocumentPropertiesCommandPort,
  type LayerDocumentPropertiesRuntimePort,
  type LayerDocumentPropertiesRuntimeState,
} from "@/engines/properties/controllers/layerDocumentPropertiesController";
import {
  buildPropertiesPropertyRows,
  buildPropertiesTransformOriginViewModel,
  type PropertiesSelectedKeyframe,
} from "@/engines/properties/helpers/propertiesViewModelHelpers";
import type {
  LayerDocumentPropertiesDescriptor,
  LayerDocumentPropertiesCapability,
} from "@/engines/properties/models/layerDocumentPropertiesModel";
import type {
  PropertiesCapabilityViewModel,
  PropertiesEngineViewProps,
  PropertiesModifierViewModel,
  PropertiesReadModel,
  PropertiesSourceDetailViewModel,
} from "@/engines/properties/models/propertiesEngineModel";

export type LayerDocumentPropertiesController = ReturnType<
  typeof createLayerDocumentPropertiesController
>;

const TYPE_LABELS: Readonly<Record<
  LayerDocumentPropertiesDescriptor["type"],
  string
>> = {
  psd: "PSD",
  drawing: "Drawing",
  text: "Text",
  audio: "Audio",
  video: "Video",
  shape: "Shape",
  group: "Group",
  unknown: "Unknown",
};

function capabilityStatus(
  value: LayerDocumentPropertiesCapability["status"]
): PropertiesCapabilityViewModel["status"] {
  return value === "future" ? "unsupported" : value;
}

function capabilityView(
  key: PropertiesCapabilityViewModel["key"],
  label: string,
  value: LayerDocumentPropertiesCapability
): PropertiesCapabilityViewModel {
  const status = capabilityStatus(value.status);
  return {
    key,
    label,
    status,
    statusLabel:
      status === "editable"
        ? "편집 가능"
        : status === "read-only"
          ? "읽기 전용"
          : "미지원",
    description: value.reason,
  };
}

function typeDetail(
  descriptor: LayerDocumentPropertiesDescriptor
): PropertiesSourceDetailViewModel | null {
  const typeData = descriptor.typeData;
  if (typeData.kind === "psd") {
    return {
      title: "PSD source",
      description: "PSD pixels are owned by Source Registry.",
      fields: [{
        label: "Source",
        value:
          descriptor.source.displayName ??
          descriptor.source.sourceId ??
          "Unresolved",
      }],
    };
  }
  if (typeData.kind === "drawing") {
    return {
      title: "Drawing document",
      description: "LayerDocument Drawing data.",
      fields: [
        {
          label: "요소",
          value: `${typeData.data.elements.length}개`,
        },
        {
          label: "문서 버전",
          value: String(typeData.data.documentVersion),
        },
      ],
    };
  }
  if (typeData.kind === "text") {
    return {
      title: "Text content",
      description: "LayerDocument Text data.",
      fields: [
        {
          label: "텍스트",
          value: typeData.data.text || "(빈 텍스트)",
        },
        {
          label: "스타일",
          value:
            `${typeData.data.style.fontFamily} · ` +
            `${typeData.data.style.fontSize}px · ` +
            typeData.data.style.color,
        },
      ],
    };
  }
  if (typeData.kind === "audio" || typeData.kind === "video") {
    return {
      title: `${TYPE_LABELS[typeData.kind]} source`,
      description: "Domain data schema is currently empty.",
      fields: [{ label: "상태", value: "Future placeholder" }],
    };
  }
  if (typeData.kind === "shape") {
    return {
      title: "Shape document",
      description: "Shape editing is not connected yet.",
      fields: [{
        label: "도형",
        value: `${typeData.data.shapes.length}개`,
      }],
    };
  }
  if (typeData.kind === "group") {
    return {
      title: descriptor.isProjectRoot
        ? "Project root"
        : "Group composition",
      description: "LayerDocument Group metadata.",
      fields: [
        {
          label: "Canvas",
          value: `${typeData.data.width} × ${typeData.data.height}`,
        },
        {
          label: "Duration",
          value: `${typeData.data.durationFrames} frames`,
        },
      ],
    };
  }
  return {
    title: "Unknown Layer",
    description: "Unknown domain data is preserved read-only.",
    fields: [{
      label: "원본 Type",
      value: typeData.data.originalType,
    }],
  };
}

function modifierViews(
  descriptor: LayerDocumentPropertiesDescriptor,
  runtime: LayerDocumentPropertiesRuntimeState
): PropertiesModifierViewModel[] {
  return descriptor.modifiers.flatMap((modifier) => {
    if (modifier.type !== "wiggle") return [];
    return [{
      type: "wiggle" as const,
      label: "Wiggle",
      fields: [
        {
          id: "modifier.wiggle.frequency" as const,
          field: "frequency" as const,
          label: "Frequency",
          value:
            runtime.inputDrafts["modifier.wiggle.frequency"] ??
            String(modifier.frequency),
        },
        {
          id: "modifier.wiggle.amount" as const,
          field: "amount" as const,
          label: "Amount",
          value:
            runtime.inputDrafts["modifier.wiggle.amount"] ??
            String(modifier.amount),
        },
      ],
    }];
  });
}

export function buildLayerDocumentPropertiesViewProps(options: {
  controller: LayerDocumentPropertiesController;
  formatTime?: (frame: number, frameRate: number) => string;
  frameRate?: number;
}): PropertiesEngineViewProps {
  const read = options.controller.read();
  const descriptor = read.descriptor.status === "ready"
    ? read.descriptor.descriptor
    : null;
  const transform = read.displayedTransform;
  const selected = options.controller.read().descriptor.status === "ready"
    ? options.controller.readSelectedKeyframe?.()
    : null;
  const selectedKeyframe: PropertiesSelectedKeyframe = selected && descriptor
    ? {
        frame: selected.localFrame,
        property: selected.property,
      }
    : null;
  const frameRate = options.frameRate ?? 30;
  const formatTime = options.formatTime ??
    ((frame: number, rate: number) =>
      `${(frame / rate).toFixed(2)}s`);
  const emptyValues = {
    position: { x: 0, y: 0 },
    scale: { x: 100, y: 100 },
    rotation: 0,
    opacity: 100,
    anchor: { x: 0, y: 0 },
  };
  const values = transform
    ? {
        position: transform.position,
        scale: transform.scale,
        rotation: transform.rotation,
        opacity: transform.opacity,
        anchor: transform.anchor,
      }
    : emptyValues;
  const editable = Object.fromEntries(
    ANIMATABLE_PROPERTIES.map((property) => [
      property,
      descriptor?.capabilities.transformInputs[property].status ===
        "editable",
    ])
  ) as Record<(typeof ANIMATABLE_PROPERTIES)[number], boolean>;
  const numericDrafts = read.runtime.inputDrafts;
  const readModel: PropertiesReadModel = {
    hasSelectedComposition: Boolean(descriptor),
    info: descriptor?.typeData.kind === "group"
      ? {
          name: descriptor.displayName,
          sourceFileName:
            descriptor.source.displayName ?? "-",
          canvasSize:
            `${descriptor.typeData.data.width} x ` +
            descriptor.typeData.data.height,
          duration:
            `${(
              descriptor.typeData.data.durationFrames /
              descriptor.typeData.data.frameRate
            ).toFixed(1)}s`,
        }
      : null,
    targetName: descriptor?.displayName ?? null,
    targetEntityKind: descriptor
      ? descriptor.type === "group"
        ? "composition"
        : "layer"
      : null,
    sourceHeader: descriptor
      ? {
          itemId: descriptor.layerDocumentId,
          sourceId:
            descriptor.source.sourceId ??
            descriptor.layerDocumentId,
          sourceName:
            descriptor.source.displayName ??
            descriptor.name,
          itemAlias: descriptor.alias,
          displayName: descriptor.displayName,
          type: descriptor.type,
          typeLabel: TYPE_LABELS[descriptor.type],
          entityKind:
            descriptor.type === "group"
              ? "composition"
              : "layer",
          availabilityLabel:
            descriptor.source.referenceStatus === "none"
              ? "내장 데이터"
              : descriptor.source.resolutionStatus === "available"
                ? "사용 가능"
                : "누락",
        }
      : null,
    sourceDetail: descriptor ? typeDetail(descriptor) : null,
    capabilities: descriptor
      ? [
          capabilityView(
            "transform",
            "Visual Transform",
            descriptor.isProjectRoot
              ? {
                  status: "editable",
                  reason:
                    "Scale, Rotation, and Opacity are editable; " +
                    "Position and Anchor remain project-owned.",
                }
              : descriptor.capabilities.transform
          ),
          capabilityView(
            "animation",
            "Animation",
            descriptor.capabilities.animation
          ),
          capabilityView(
            "content",
            "Content",
            descriptor.capabilities.domain
          ),
        ]
      : [],
    transformSectionVisible: Boolean(descriptor && transform),
    currentTimeText: formatTime(read.globalFrame, frameRate),
    currentValues: values,
    rows: buildPropertiesPropertyRows({
      properties: ANIMATABLE_PROPERTIES,
      propertyState:
        descriptor?.animation.enabledProperties ?? {
          position: false,
          scale: false,
          rotation: false,
          opacity: false,
        },
      values,
      editableProperties: editable,
      trackEditableProperties: editable,
      scaleLinked: transform?.scaleLinked ?? true,
      numericDrafts,
      hasKeyframeAtCurrentFrame: (property) => {
        if (!descriptor || read.localFrame === null) return false;
        const keyframes = descriptor.animation[
          `${property}Keyframes` as keyof typeof descriptor.animation
        ];
        return Array.isArray(keyframes) && keyframes.some(
          (keyframe) => keyframe.frame === read.localFrame
        );
      },
      selectedKeyframe,
    }),
    transformOrigin: buildPropertiesTransformOriginViewModel({
      values,
      editable:
        descriptor?.capabilities.transformInputs.anchor.status ===
          "editable",
      numericDrafts,
    }),
    keyframe: {
      visible: Boolean(descriptor),
      showPositionSave: Boolean(
        descriptor &&
        descriptor.capabilities.transformInputs.position.status ===
          "editable"
      ),
      canSavePosition: Boolean(
        descriptor?.animation.enabledProperties.position &&
        editable.position
      ),
      selectedText: selected
        ? `${selected.property} · ` +
          formatTime(selected.localFrame, frameRate)
        : "없음",
      canDeleteSelected: Boolean(selected),
    },
    modifiers: descriptor
      ? modifierViews(descriptor, read.runtime)
      : [],
    modifierLibrary: {
      visible:
        descriptor?.capabilities.modifiers.status === "editable",
      items: [{
        type: "wiggle",
        label: "Wiggle",
        active: Boolean(
          descriptor?.modifiers.some(
            (modifier) => modifier.type === "wiggle"
          )
        ),
      }],
    },
    importError: null,
    importNotice: null,
  };
  return {
    readModel,
    commands: {
      togglePropertyTrack:
        options.controller.togglePropertyTrack,
      focusNumericInput:
        options.controller.focusNumericInput,
      changeNumericInput:
        options.controller.changeNumericInput,
      blurNumericInput:
        options.controller.blurNumericInput,
      keyDownNumericInput:
        options.controller.keyDownNumericInput,
      toggleScaleLink:
        options.controller.toggleScaleLink,
      savePositionKeyframe:
        options.controller.savePositionKeyframe,
      deleteSelectedKeyframe:
        options.controller.deleteSelectedKeyframe,
      toggleModifier:
        options.controller.toggleModifier,
      focusModifierInput:
        options.controller.focusModifierInput,
      changeModifierInput:
        options.controller.changeModifierInput,
      blurModifierInput:
        options.controller.blurModifierInput,
      keyDownModifierInput:
        options.controller.keyDownModifierInput,
    },
  };
}

function initialRuntime(
  port: LayerDocumentPropertiesCommandPort
): LayerDocumentPropertiesRuntimeState {
  const read = port.read();
  const descriptor = read.descriptor.status === "ready"
    ? read.descriptor.descriptor
    : null;
  return {
    selectedLayerDocumentId:
      descriptor?.layerDocumentId ?? null,
    selectedLayerRevision: descriptor?.revision ?? null,
    globalFrame: read.globalFrame,
    localFrame: read.localFrame,
    focusedInputId: null,
    focusedTransform: null,
    inputDrafts: {},
  };
}

export function useLayerDocumentPropertiesEngine(options: {
  port: LayerDocumentPropertiesCommandPort;
  formatTime?: (frame: number, frameRate: number) => string;
  frameRate?: number;
  resetRevision?: number;
}) {
  const [runtime, setRuntime] =
    useState<LayerDocumentPropertiesRuntimeState>(
      () => initialRuntime(options.port)
    );
  const runtimePort = useMemo<
    LayerDocumentPropertiesRuntimePort
  >(() => ({
    read: () => runtime,
    replace: setRuntime,
  }), [runtime]);
  const controller = useMemo(
    () => createLayerDocumentPropertiesController({
      port: options.port,
      runtime: runtimePort,
    }),
    [options.port, runtimePort]
  );
  const scope = options.port.read();
  const scopeIdentity = [
    scope.descriptor.status === "ready"
      ? scope.descriptor.descriptor.layerDocumentId
      : "none",
    scope.descriptor.status === "ready"
      ? scope.descriptor.descriptor.revision
      : "none",
    scope.globalFrame,
    scope.localFrame,
  ].join(":");
  useEffect(() => {
    controller.syncSelection();
  }, [controller, scopeIdentity]);
  useEffect(() => {
    if (options.resetRevision === undefined) return;
    // Owner History/session restoration invalidates every local input Draft.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRuntime(initialRuntime(options.port));
  }, [
    options.port,
    options.resetRevision,
  ]);
  return {
    controller,
    viewProps: buildLayerDocumentPropertiesViewProps({
      controller,
      formatTime: options.formatTime,
      frameRate: options.frameRate,
    }),
  };
}
