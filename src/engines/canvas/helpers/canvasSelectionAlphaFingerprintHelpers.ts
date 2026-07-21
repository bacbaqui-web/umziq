import type {
  SelectionSourceAlphaDescriptor,
  SelectionSubCompositionAlphaChild,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";

export type SelectionAlphaCanvasTokenResolver = (
  canvas: HTMLCanvasElement
) => number;

function normalizeNumber(value: number) {
  if (!Number.isFinite(value)) return null;
  return Object.is(value, -0) ? 0 : value;
}

function normalizeOpacity(value: number) {
  if (!Number.isFinite(value)) return null;
  return normalizeNumber(Math.min(100, Math.max(0, value)));
}

function buildTransformSignature(
  transform: SelectionSubCompositionAlphaChild["transform"]
) {
  return [
    normalizeNumber(transform.position.x),
    normalizeNumber(transform.position.y),
    normalizeNumber(transform.transformOffset.x),
    normalizeNumber(transform.transformOffset.y),
    normalizeNumber(transform.anchor.x),
    normalizeNumber(transform.anchor.y),
    normalizeNumber(transform.scale.x),
    normalizeNumber(transform.scale.y),
    normalizeNumber(transform.rotation),
  ];
}

function buildDescriptorSignature(
  descriptor: SelectionSourceAlphaDescriptor,
  getCanvasToken: SelectionAlphaCanvasTokenResolver
): unknown[] {
  const common = [
    descriptor.sourceFingerprint,
    descriptor.sourceRevision,
    descriptor.frameVisualKey,
    normalizeNumber(descriptor.logicalSize.width),
    normalizeNumber(descriptor.logicalSize.height),
    normalizeOpacity(descriptor.opacity),
    descriptor.visible,
  ];

  if (descriptor.kind === "layer") {
    return [
      "layer-alpha-v1",
      getCanvasToken(descriptor.sourceCanvas),
      descriptor.sourceCanvas.width,
      descriptor.sourceCanvas.height,
      ...common,
    ];
  }

  return [
    "subcomp-alpha-v1",
    ...common,
    descriptor.orderedChildren.map((child) => [
      buildDescriptorSignature(child.source, getCanvasToken),
      buildTransformSignature(child.transform),
    ]),
  ];
}

export function buildSelectionSourceAlphaFingerprint(
  descriptor: SelectionSourceAlphaDescriptor,
  getCanvasToken: SelectionAlphaCanvasTokenResolver
) {
  return JSON.stringify(buildDescriptorSignature(descriptor, getCanvasToken));
}
