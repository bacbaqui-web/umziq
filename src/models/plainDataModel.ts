export type PlainDataPrimitive = string | number | boolean | null;

export type PlainDataValue =
  | PlainDataPrimitive
  | PlainDataValue[]
  | { [key: string]: PlainDataValue };

export type PlainDataObject = { [key: string]: PlainDataValue };

export function findNonPlainDataPath(
  value: unknown,
  path = "$",
  visited = new Set<object>()
): string | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? null : path;
  }

  if (typeof value !== "object") {
    return path;
  }

  if (visited.has(value)) {
    return path;
  }
  visited.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const invalidPath = findNonPlainDataPath(
        value[index],
        `${path}[${index}]`,
        visited
      );
      if (invalidPath) return invalidPath;
    }
    visited.delete(value);
    return null;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return path;
  }

  for (const [key, entry] of Object.entries(value)) {
    const invalidPath = findNonPlainDataPath(entry, `${path}.${key}`, visited);
    if (invalidPath) return invalidPath;
  }

  visited.delete(value);
  return null;
}
