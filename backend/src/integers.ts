const MIN_SAFE_INTEGER = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Convert an SQLite INTEGER, read as a bigint, into a value JSON carries
 * without losing a digit. `node:sqlite` throws on an INTEGER outside
 * ±(2^53 − 1) unless the statement reads bigints, and JSON cannot carry a
 * bigint at all.
 * @param value - Integer read from a statement with `setReadBigInts(true)`.
 * @returns The number when it is a safe integer, otherwise its exact
 *   decimal string.
 */
export function toJsonSafeInteger(value: bigint): number | string {
  return value >= MIN_SAFE_INTEGER && value <= MAX_SAFE_INTEGER
    ? Number(value)
    : value.toString();
}
