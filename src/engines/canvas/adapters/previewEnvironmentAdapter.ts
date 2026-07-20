export function readPreviewDeviceMemoryGb(): number | null {
  if (typeof navigator === "undefined") return null;
  const value = (navigator as Navigator & { deviceMemory?: unknown })
    .deviceMemory;
  return typeof value === "number" ? value : null;
}
