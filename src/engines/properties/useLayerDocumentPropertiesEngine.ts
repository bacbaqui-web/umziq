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
  PropertiesAudioInputId,
  PropertiesEngineViewProps,
  PropertiesModifierViewModel,
  PropertiesReadModel,
  PropertiesSourceDetailViewModel,
} from "@/engines/properties/models/propertiesEngineModel";

type AudioPropertiesDescriptor = LayerDocumentPropertiesDescriptor & {
  typeData: Extract<LayerDocumentPropertiesDescriptor["typeData"], { kind: "audio" }>;
};

function isAudioPropertiesDescriptor(
  descriptor: LayerDocumentPropertiesDescriptor | null
): descriptor is AudioPropertiesDescriptor {
  return descriptor?.typeData.kind === "audio";
}

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
  runtime: LayerDocumentPropertiesRuntimeState,
  mouthAudioOptions: readonly { id: string; label: string }[] = []
): PropertiesModifierViewModel[] {
  return descriptor.modifiers.flatMap((modifier): PropertiesModifierViewModel[] => {
    if (modifier.type === "wiggle") return [{
      type: "wiggle" as const,
      label: "부들부들",
      fields: [
        {
          id: "modifier.wiggle.frequency" as const,
          field: "frequency" as const,
          label: "초당 횟수",
          suffix: "/s",
          value:
            runtime.inputDrafts["modifier.wiggle.frequency"] ??
            String(modifier.frequency),
        },
        {
          id: "modifier.wiggle.amount" as const,
          field: "amount" as const,
          label: "흔들림 정도",
          suffix: "px",
          value:
            runtime.inputDrafts["modifier.wiggle.amount"] ??
            String(modifier.amount),
        },
      ],
    }];
    if (modifier.type === "swing") return [{
      type: "swing" as const,
      label: "흔들흔들",
      fields: [
        {
          id: "modifier.swing.frequency" as const,
          field: "frequency" as const,
          label: "초당 횟수",
          suffix: "/s",
          value:
            runtime.inputDrafts["modifier.swing.frequency"] ??
            String(modifier.frequency),
        },
        {
          id: "modifier.swing.amount" as const,
          field: "amount" as const,
          label: "회전 각도",
          suffix: "°",
          value:
            runtime.inputDrafts["modifier.swing.amount"] ??
            String(modifier.amount),
        },
      ],
    }];
    if (modifier.type === "oscillate") return [{
      type: "oscillate" as const,
      label: "왔다갔다",
      fields: [
        {
          id: "modifier.oscillate.angle" as const,
          field: "angle" as const,
          label: "이동 각도",
          suffix: "°",
          value:
            runtime.inputDrafts["modifier.oscillate.angle"] ??
            String(modifier.angle),
        },
        {
          id: "modifier.oscillate.frequency" as const,
          field: "frequency" as const,
          label: "초당 횟수",
          suffix: "/s",
          value:
            runtime.inputDrafts["modifier.oscillate.frequency"] ??
            String(modifier.frequency),
        },
        {
          id: "modifier.oscillate.amount" as const,
          field: "amount" as const,
          label: "이동 거리",
          suffix: "px",
          value:
            runtime.inputDrafts["modifier.oscillate.amount"] ??
            String(modifier.amount),
        },
      ],
    }];
    if (modifier.type === "mouth-basic") return [{
      type: "mouth-basic" as const,
      label: "입뻥긋(기본)",
      fields: [],
      audioLayerDocumentId: modifier.audioLayerDocumentId,
      audioOptions: mouthAudioOptions,
    }];
    if (modifier.type === "acceleration") return [{
      type: "acceleration" as const,
      label: "가속·감속",
      fields: [],
      accelerationProperties: modifier.properties,
      accelerationCurve: modifier.curve,
    }];
    return [];
  });
}

export function buildLayerDocumentPropertiesViewProps(options: {
  controller: LayerDocumentPropertiesController;
  formatTime?: (frame: number, frameRate: number) => string;
  frameRate?: number;
  audioDrafts?: Partial<Record<PropertiesAudioInputId, string>>;
  audioCommands?: Pick<PropertiesEngineViewProps["commands"], "focusAudioInput" | "changeAudioInput" | "blurAudioInput" | "keyDownAudioInput" | "toggleAudioMuted">;
  mouthAudioOptions?: readonly { id: string; label: string }[];
  setMouthBasicAudioLayer?: (audioLayerDocumentId: string) => void;
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
  const audio = isAudioPropertiesDescriptor(descriptor) ? descriptor : null;
  const audioValue = (id: PropertiesAudioInputId, fallback: string) =>
    options.audioDrafts?.[id] ?? fallback;
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
    // The synthetic project root is an editor implementation detail rather
    // than a user-editable item, so the Properties panel stays empty for it.
    targetName:
      descriptor && !descriptor.isProjectRoot
        ? descriptor.displayName
        : null,
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
    transformSectionVisible: Boolean(descriptor && transform && descriptor.type !== "audio"),
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
      visible: Boolean(descriptor && descriptor.type !== "audio"),
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
    modifiers: descriptor && descriptor.type !== "audio"
      ? modifierViews(descriptor, read.runtime, options.mouthAudioOptions)
      : [],
    modifierLibrary: {
      visible:
        descriptor?.type !== "audio" && descriptor?.capabilities.modifiers.status === "editable",
      items: [
        {
          type: "acceleration",
          label: "가속·감속",
          active: Boolean(
            descriptor?.modifiers.some((modifier) => modifier.type === "acceleration")
          ),
        },
        {
          type: "mouth-basic",
          label: "입뻥긋(기본)",
          active: Boolean(
            descriptor?.modifiers.some((modifier) => modifier.type === "mouth-basic")
          ),
        },
        {
          type: "wiggle",
          label: "부들부들",
          active: Boolean(
            descriptor?.modifiers.some(
              (modifier) => modifier.type === "wiggle"
            )
          ),
        },
        {
          type: "swing",
          label: "흔들흔들",
          active: Boolean(
            descriptor?.modifiers.some(
              (modifier) => modifier.type === "swing"
            )
          ),
        },
        {
          type: "oscillate",
          label: "왔다갔다",
          active: Boolean(
            descriptor?.modifiers.some(
              (modifier) => modifier.type === "oscillate"
            )
          ),
        },
      ],
    },
    audioSection: audio ? {
      layerDocumentId: audio.layerDocumentId,
      muted: audio.typeData.data.muted,
      fields: [
        { id: "audio.name", label: "이름", value: audioValue("audio.name", audio.name), numeric: false },
        { id: "audio.gain", label: "음량", value: audioValue("audio.gain", String(audio.typeData.data.gain)), suffix: "x", numeric: true, step: 0.05 },
        { id: "audio.startFrame", label: "시작 프레임", value: audioValue("audio.startFrame", String(audio.placement.startFrame)), numeric: true, step: 1 },
        { id: "audio.durationFrames", label: "길이", value: audioValue("audio.durationFrames", String(audio.placement.durationFrames)), suffix: "f", numeric: true, step: 1 },
        { id: "audio.sourceOffsetFrames", label: "원본 시작", value: audioValue("audio.sourceOffsetFrames", String(audio.placement.sourceOffsetFrames)), suffix: "f", numeric: true, step: 1 },
        { id: "audio.fadeInFrames", label: "페이드 인", value: audioValue("audio.fadeInFrames", String(audio.typeData.data.fadeInFrames)), suffix: "f", numeric: true, step: 1 },
        { id: "audio.fadeOutFrames", label: "페이드 아웃", value: audioValue("audio.fadeOutFrames", String(audio.typeData.data.fadeOutFrames)), suffix: "f", numeric: true, step: 1 },
      ],
    } : null,
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
      setMouthBasicAudioLayer: options.setMouthBasicAudioLayer ?? (() => undefined),
      toggleAccelerationProperty: (property) => {
        const current = options.controller.read();
        if (current.descriptor.status !== "ready") return;
        const modifier = current.descriptor.descriptor.modifiers.find(
          (candidate) => candidate.type === "acceleration"
        );
        if (!modifier || modifier.type !== "acceleration") return;
        const properties = modifier.properties.includes(property)
          ? modifier.properties.filter((candidate) => candidate !== property)
          : [...modifier.properties, property];
        if (properties.length === 0) return;
        options.controller.setModifiers(current.descriptor.descriptor.modifiers.map((candidate) =>
          candidate.modifierId === modifier.modifierId ? { ...modifier, properties } : candidate
        ));
      },
      setAccelerationCurve: (curve) => {
        const current = options.controller.read();
        if (current.descriptor.status !== "ready") return;
        const modifier = current.descriptor.descriptor.modifiers.find(
          (candidate) => candidate.type === "acceleration"
        );
        if (!modifier || modifier.type !== "acceleration") return;
        options.controller.setModifiers(current.descriptor.descriptor.modifiers.map((candidate) =>
          candidate.modifierId === modifier.modifierId ? { ...modifier, curve } : candidate
        ));
      },
      focusModifierInput:
        options.controller.focusModifierInput,
      changeModifierInput:
        options.controller.changeModifierInput,
      blurModifierInput:
        options.controller.blurModifierInput,
      keyDownModifierInput:
        options.controller.keyDownModifierInput,
      focusAudioInput: options.audioCommands?.focusAudioInput ?? (() => undefined),
      changeAudioInput: options.audioCommands?.changeAudioInput ?? (() => undefined),
      blurAudioInput: options.audioCommands?.blurAudioInput ?? (() => undefined),
      keyDownAudioInput: options.audioCommands?.keyDownAudioInput ?? (() => null),
      toggleAudioMuted: options.audioCommands?.toggleAudioMuted ?? (() => undefined),
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
  mouthBasic?: {
    readAudioOptions: () => readonly { id: string; label: string }[];
    connect: (targetLayerDocumentId: string, audioLayerDocumentId: string) => void;
  };
}) {
  const [runtime, setRuntime] =
    useState<LayerDocumentPropertiesRuntimeState>(
      () => initialRuntime(options.port)
    );
  const [audioDraft, setAudioDraft] = useState<{
    selectionId: string | null;
    values: Partial<Record<PropertiesAudioInputId, string>>;
  }>({ selectionId: null, values: {} });
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
    setAudioDraft({ selectionId: null, values: {} });
  }, [
    options.port,
    options.resetRevision,
  ]);
  const readyAudioDescriptor = () => {
    const current = options.port.read().descriptor;
    return current.status === "ready" && current.descriptor.typeData.kind === "audio"
      ? current.descriptor as AudioPropertiesDescriptor
      : null;
  };
  const currentAudioValue = (descriptor: NonNullable<ReturnType<typeof readyAudioDescriptor>>, id: PropertiesAudioInputId) => {
    switch (id) {
      case "audio.name": return descriptor.name;
      case "audio.gain": return String(descriptor.typeData.data.gain);
      case "audio.startFrame": return String(descriptor.placement.startFrame);
      case "audio.durationFrames": return String(descriptor.placement.durationFrames);
      case "audio.sourceOffsetFrames": return String(descriptor.placement.sourceOffsetFrames);
      case "audio.fadeInFrames": return String(descriptor.typeData.data.fadeInFrames);
      case "audio.fadeOutFrames": return String(descriptor.typeData.data.fadeOutFrames);
    }
  };
  const commitAudioDraft = (inputId: PropertiesAudioInputId) => {
    const descriptor = readyAudioDescriptor();
    if (!descriptor || audioDraft.selectionId !== descriptor.layerDocumentId || audioDraft.values[inputId] === undefined) return;
    const value = (id: PropertiesAudioInputId) => audioDraft.values[id] ?? currentAudioValue(descriptor, id);
    const number = (id: PropertiesAudioInputId) => Number(value(id));
    if (inputId !== "audio.name" && !Number.isFinite(number(inputId))) {
      setAudioDraft({ selectionId: null, values: {} });
      return;
    }
    controller.dispatch({
      kind: "set-audio-properties",
      layerDocumentId: descriptor.layerDocumentId,
      name: value("audio.name"),
      gain: number("audio.gain"),
      muted: descriptor.typeData.data.muted,
      startFrame: number("audio.startFrame"),
      durationFrames: number("audio.durationFrames"),
      sourceOffsetFrames: number("audio.sourceOffsetFrames"),
      fadeInFrames: number("audio.fadeInFrames"),
      fadeOutFrames: number("audio.fadeOutFrames"),
    });
    setAudioDraft({ selectionId: null, values: {} });
  };
  const audioCommands = {
    focusAudioInput: (inputId: PropertiesAudioInputId) => {
      const descriptor = readyAudioDescriptor();
      if (!descriptor) return;
      setAudioDraft({ selectionId: descriptor.layerDocumentId, values: { [inputId]: currentAudioValue(descriptor, inputId) } });
    },
    changeAudioInput: (inputId: PropertiesAudioInputId, value: string) => {
      const descriptor = readyAudioDescriptor();
      if (!descriptor) return;
      setAudioDraft((current) => ({
        selectionId: descriptor.layerDocumentId,
        values: current.selectionId === descriptor.layerDocumentId ? { ...current.values, [inputId]: value } : { [inputId]: value },
      }));
    },
    blurAudioInput: commitAudioDraft,
    keyDownAudioInput: (inputId: PropertiesAudioInputId, key: string) => {
      if (key === "Escape") {
        setAudioDraft({ selectionId: null, values: {} });
        return "blur" as const;
      }
      if (key === "Enter") {
        commitAudioDraft(inputId);
        return "blur" as const;
      }
      return null;
    },
    toggleAudioMuted: () => {
      const descriptor = readyAudioDescriptor();
      if (!descriptor) return;
      controller.dispatch({
        kind: "set-audio-properties", layerDocumentId: descriptor.layerDocumentId,
        name: descriptor.name, gain: descriptor.typeData.data.gain,
        muted: !descriptor.typeData.data.muted,
        startFrame: descriptor.placement.startFrame, durationFrames: descriptor.placement.durationFrames,
        sourceOffsetFrames: descriptor.placement.sourceOffsetFrames,
        fadeInFrames: descriptor.typeData.data.fadeInFrames, fadeOutFrames: descriptor.typeData.data.fadeOutFrames,
      });
    },
  };
  return {
    controller,
    viewProps: buildLayerDocumentPropertiesViewProps({
      controller,
      formatTime: options.formatTime,
      frameRate: options.frameRate,
      audioDrafts: audioDraft.selectionId === (scope.descriptor.status === "ready" ? scope.descriptor.descriptor.layerDocumentId : null) ? audioDraft.values : {},
      audioCommands,
      mouthAudioOptions: options.mouthBasic?.readAudioOptions() ?? [],
      setMouthBasicAudioLayer: (audioLayerDocumentId) => {
        const current = options.port.read().descriptor;
        if (current.status !== "ready" || !audioLayerDocumentId) return;
        options.mouthBasic?.connect(current.descriptor.layerDocumentId, audioLayerDocumentId);
      },
    }),
  };
}
