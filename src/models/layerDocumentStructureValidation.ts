import type { LayerDocumentValidationIssue, UnknownRecord } from "@/models/layerDocumentSourceValidation";
import { addIssue, requireRecord, validateBoolean, validateExactKeys, validateNumber, validatePosition, validateString, validateStringArrayObjects } from "@/models/layerDocumentSourceValidation";

const LAYER_TYPES = new Set([
  "psd",
  "drawing",
  "text",
  "audio",
  "video",
  "shape",
  "group",
  "unknown",
]);

function validateTransform(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  const record = requireRecord(value, path, issues);
  if (!record) return;
  validateExactKeys(
    record,
    [
      "position",
      "transformOffset",
      "anchor",
      "scale",
      "scaleLinked",
      "rotation",
      "opacity",
    ],
    path,
    issues
  );
  validatePosition(record.position, `${path}.position`, issues);
  validatePosition(record.transformOffset, `${path}.transformOffset`, issues);
  validatePosition(record.anchor, `${path}.anchor`, issues);
  validatePosition(record.scale, `${path}.scale`, issues);
  validateBoolean(record.scaleLinked, `${path}.scaleLinked`, issues);
  validateNumber(record.rotation, `${path}.rotation`, issues, {
    code: "invalid-transform",
  });
  validateNumber(record.opacity, `${path}.opacity`, issues, {
    minimum: 0,
    maximum: 100,
    code: "invalid-transform",
  });
}

function validateKeyframes(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[],
  valueKind: "position" | "scale" | "rotation" | "opacity"
) {
  if (!Array.isArray(value)) {
    addIssue(issues, "invalid-shape", path, "Expected a keyframe array");
    return;
  }
  const frames = new Set<number>();
  value.forEach((entry, index) => {
    const keyframePath = `${path}[${index}]`;
    const keyframe = requireRecord(entry, keyframePath, issues);
    if (!keyframe) return;
    validateExactKeys(keyframe, ["frame", "value"], keyframePath, issues);
    validateNumber(keyframe.frame, `${keyframePath}.frame`, issues, {
      integer: true,
      minimum: 0,
      code: "invalid-timing",
    });
    if (typeof keyframe.frame === "number" && Number.isInteger(keyframe.frame)) {
      if (frames.has(keyframe.frame)) {
        addIssue(
          issues,
          "duplicate-id",
          `${keyframePath}.frame`,
          "A property track cannot contain two keyframes at the same frame"
        );
      }
      frames.add(keyframe.frame);
    }
    if (valueKind === "position" || valueKind === "scale") {
      validatePosition(
        keyframe.value,
        `${keyframePath}.value`,
        issues,
        "invalid-number"
      );
    } else {
      validateNumber(keyframe.value, `${keyframePath}.value`, issues, {
        minimum: valueKind === "opacity" ? 0 : undefined,
        maximum: valueKind === "opacity" ? 100 : undefined,
      });
    }
  });
}

function validateAnimation(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  const record = requireRecord(value, path, issues);
  if (!record) return;
  validateExactKeys(
    record,
    [
      "positionKeyframes",
      "scaleKeyframes",
      "rotationKeyframes",
      "opacityKeyframes",
      "enabledProperties",
    ],
    path,
    issues
  );
  validateKeyframes(
    record.positionKeyframes,
    `${path}.positionKeyframes`,
    issues,
    "position"
  );
  validateKeyframes(
    record.scaleKeyframes,
    `${path}.scaleKeyframes`,
    issues,
    "scale"
  );
  validateKeyframes(
    record.rotationKeyframes,
    `${path}.rotationKeyframes`,
    issues,
    "rotation"
  );
  validateKeyframes(
    record.opacityKeyframes,
    `${path}.opacityKeyframes`,
    issues,
    "opacity"
  );
  const enabled = requireRecord(
    record.enabledProperties,
    `${path}.enabledProperties`,
    issues
  );
  if (!enabled) return;
  validateExactKeys(
    enabled,
    ["position", "scale", "rotation", "opacity"],
    `${path}.enabledProperties`,
    issues
  );
  ["position", "scale", "rotation", "opacity"].forEach((property) => {
    validateBoolean(
      enabled[property],
      `${path}.enabledProperties.${property}`,
      issues
    );
  });
}

function validatePlacement(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  const record = requireRecord(value, path, issues);
  if (!record) return;
  validateExactKeys(
    record,
    [
      "parentLayerDocumentId",
      "order",
      "startFrame",
      "durationFrames",
      "sourceOffsetFrames",
      "visible",
      "alias",
    ],
    path,
    issues
  );
  validateString(
    record.parentLayerDocumentId,
    `${path}.parentLayerDocumentId`,
    issues,
    { nullable: true, nonEmpty: true }
  );
  validateNumber(record.order, `${path}.order`, issues, {
    integer: true,
    minimum: 0,
    code: "invalid-sibling-order",
  });
  validateNumber(record.startFrame, `${path}.startFrame`, issues, {
    integer: true,
    minimum: 0,
    code: "invalid-timing",
  });
  validateNumber(record.durationFrames, `${path}.durationFrames`, issues, {
    integer: true,
    minimum: 1,
    code: "invalid-timing",
  });
  validateNumber(
    record.sourceOffsetFrames,
    `${path}.sourceOffsetFrames`,
    issues,
    {
      integer: true,
      minimum: 0,
      code: "invalid-timing",
    }
  );
  validateBoolean(record.visible, `${path}.visible`, issues);
  validateString(record.alias, `${path}.alias`, issues, { nullable: true });
}

function validateEffects(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  if (!Array.isArray(value)) {
    addIssue(issues, "invalid-shape", path, "Expected an effect array");
    return;
  }
  const effectIds = new Set<string>();
  value.forEach((entry, index) => {
    const effectPath = `${path}[${index}]`;
    const effect = requireRecord(entry, effectPath, issues);
    if (!effect) return;
    validateExactKeys(
      effect,
      ["effectId", "type", "enabled", "parameters"],
      effectPath,
      issues
    );
    validateString(effect.effectId, `${effectPath}.effectId`, issues, {
      nonEmpty: true,
    });
    validateString(effect.type, `${effectPath}.type`, issues, {
      nonEmpty: true,
    });
    validateBoolean(effect.enabled, `${effectPath}.enabled`, issues);
    requireRecord(effect.parameters, `${effectPath}.parameters`, issues);
    if (typeof effect.effectId === "string") {
      if (effectIds.has(effect.effectId)) {
        addIssue(
          issues,
          "duplicate-id",
          `${effectPath}.effectId`,
          "Effect IDs must be unique within one Layer Document"
        );
      }
      effectIds.add(effect.effectId);
    }
  });
}

function validateModifiers(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  if (!Array.isArray(value)) {
    addIssue(issues, "invalid-shape", path, "Expected a modifier array");
    return;
  }
  const modifierIds = new Set<string>();
  value.forEach((entry, index) => {
    const modifierPath = `${path}[${index}]`;
    const modifier = requireRecord(entry, modifierPath, issues);
    if (!modifier) return;
    if (modifier.type === "wiggle") {
      validateExactKeys(
        modifier,
        ["modifierId", "type", "enabled", "frequency", "amount"],
        modifierPath,
        issues
      );
      validateNumber(
        modifier.frequency,
        `${modifierPath}.frequency`,
        issues,
        { minimum: 0 }
      );
      validateNumber(modifier.amount, `${modifierPath}.amount`, issues, {
        minimum: 0,
      });
    } else if (modifier.type === "unknown") {
      validateExactKeys(
        modifier,
        [
          "modifierId",
          "type",
          "enabled",
          "originalType",
          "parameters",
        ],
        modifierPath,
        issues
      );
      validateString(
        modifier.originalType,
        `${modifierPath}.originalType`,
        issues,
        { nonEmpty: true }
      );
      requireRecord(
        modifier.parameters,
        `${modifierPath}.parameters`,
        issues
      );
    } else {
      addIssue(
        issues,
        "invalid-type-data",
        `${modifierPath}.type`,
        "Unknown modifier type must use the unknown modifier member"
      );
    }
    validateString(
      modifier.modifierId,
      `${modifierPath}.modifierId`,
      issues,
      { nonEmpty: true }
    );
    validateBoolean(modifier.enabled, `${modifierPath}.enabled`, issues);
    if (typeof modifier.modifierId === "string") {
      if (modifierIds.has(modifier.modifierId)) {
        addIssue(
          issues,
          "duplicate-id",
          `${modifierPath}.modifierId`,
          "Modifier IDs must be unique within one Layer Document"
        );
      }
      modifierIds.add(modifier.modifierId);
    }
  });
}

function validateLayerData(
  layer: UnknownRecord,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  const dataPath = `${path}.data`;
  const data = requireRecord(layer.data, dataPath, issues);
  if (!data || typeof layer.type !== "string") return;
  switch (layer.type) {
    case "psd":
    case "audio":
    case "video":
      validateExactKeys(data, [], dataPath, issues);
      return;
    case "drawing":
      validateExactKeys(data, ["documentVersion", "elements"], dataPath, issues);
      validateNumber(data.documentVersion, `${dataPath}.documentVersion`, issues, {
        integer: true,
        minimum: 1,
      });
      validateStringArrayObjects(data.elements, `${dataPath}.elements`, issues);
      return;
    case "text": {
      validateExactKeys(data, ["text", "style"], dataPath, issues);
      validateString(data.text, `${dataPath}.text`, issues);
      const style = requireRecord(data.style, `${dataPath}.style`, issues);
      if (!style) return;
      validateExactKeys(
        style,
        ["fontFamily", "fontSize", "color"],
        `${dataPath}.style`,
        issues
      );
      validateString(style.fontFamily, `${dataPath}.style.fontFamily`, issues, {
        nonEmpty: true,
      });
      validateNumber(style.fontSize, `${dataPath}.style.fontSize`, issues, {
        minimum: 0.01,
      });
      validateString(style.color, `${dataPath}.style.color`, issues, {
        nonEmpty: true,
      });
      return;
    }
    case "shape":
      validateExactKeys(data, ["documentVersion", "shapes"], dataPath, issues);
      validateNumber(data.documentVersion, `${dataPath}.documentVersion`, issues, {
        integer: true,
        minimum: 1,
      });
      validateStringArrayObjects(data.shapes, `${dataPath}.shapes`, issues);
      return;
    case "group":
      validateExactKeys(
        data,
        ["role", "width", "height", "frameRate", "durationFrames"],
        dataPath,
        issues
      );
      if (data.role !== "project-root" && data.role !== "composition") {
        addIssue(
          issues,
          "invalid-type-data",
          `${dataPath}.role`,
          "Invalid Group role"
        );
      }
      validateNumber(data.width, `${dataPath}.width`, issues, { minimum: 1 });
      validateNumber(data.height, `${dataPath}.height`, issues, { minimum: 1 });
      validateNumber(data.frameRate, `${dataPath}.frameRate`, issues, {
        minimum: 0.01,
      });
      validateNumber(data.durationFrames, `${dataPath}.durationFrames`, issues, {
        integer: true,
        minimum: 1,
        code: "invalid-timing",
      });
      return;
    case "unknown":
      validateExactKeys(data, ["originalType", "rawData"], dataPath, issues);
      validateString(data.originalType, `${dataPath}.originalType`, issues, {
        nonEmpty: true,
      });
      requireRecord(data.rawData, `${dataPath}.rawData`, issues);
      return;
    default:
      addIssue(
        issues,
        "invalid-type-data",
        `${path}.type`,
        "Unknown Layer type must be normalized to type=unknown"
      );
  }
}

function validateCommon(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  const common = requireRecord(value, path, issues);
  if (!common) return;
  validateExactKeys(
    common,
    ["source", "transform", "placement", "animation", "effects", "modifiers"],
    path,
    issues
  );
  if (common.source !== null) {
    const source = requireRecord(common.source, `${path}.source`, issues);
    if (source) {
      validateExactKeys(source, ["sourceId"], `${path}.source`, issues);
      validateString(source.sourceId, `${path}.source.sourceId`, issues, {
        nonEmpty: true,
      });
    }
  }
  validateTransform(common.transform, `${path}.transform`, issues);
  validatePlacement(common.placement, `${path}.placement`, issues);
  validateAnimation(common.animation, `${path}.animation`, issues);
  validateEffects(common.effects, `${path}.effects`, issues);
  validateModifiers(common.modifiers, `${path}.modifiers`, issues);
}

export function validateLayerDocument(
  layer: unknown,
  layerKey: string,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  const record = requireRecord(layer, path, issues);
  if (!record) return;
  validateExactKeys(
    record,
    ["layerDocumentId", "name", "revision", "type", "common", "data"],
    path,
    issues
  );
  validateString(record.layerDocumentId, `${path}.layerDocumentId`, issues, {
    nonEmpty: true,
  });
  validateString(record.name, `${path}.name`, issues, {
    nonEmpty: true,
  });
  if (record.layerDocumentId !== layerKey) {
    addIssue(
      issues,
      "key-id-mismatch",
      `${path}.layerDocumentId`,
      "Layer dictionary key and layerDocumentId differ"
    );
  }
  validateNumber(record.revision, `${path}.revision`, issues, {
    integer: true,
    minimum: 0,
  });
  if (typeof record.type !== "string" || !LAYER_TYPES.has(record.type)) {
    addIssue(
      issues,
      "invalid-type-data",
      `${path}.type`,
      "Unknown Layer type must be normalized to type=unknown"
    );
  }
  validateCommon(record.common, `${path}.common`, issues);
  validateLayerData(record, path, issues);
}
