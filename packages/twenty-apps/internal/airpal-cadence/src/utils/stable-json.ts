// JSON with object keys sorted, so two values that are equal compare equal as
// strings whatever order a database or API returned their keys in.
export const stableStringify = (value: unknown): string =>
  JSON.stringify(sortKeysDeep(value));

const sortKeysDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
        .map((key) => [key, sortKeysDeep((value as Record<string, unknown>)[key])]),
    );
  }

  return value;
};

export const isDeepEqualJson = (first: unknown, second: unknown): boolean =>
  stableStringify(first) === stableStringify(second);
