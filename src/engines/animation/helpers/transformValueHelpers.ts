export function clampOpacity(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function normalizeRotationDegrees(value: number) {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
}
