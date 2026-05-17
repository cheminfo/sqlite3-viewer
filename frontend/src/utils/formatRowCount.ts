/**
 * Format a row count for display, prefixing with "~" when approximate.
 * @param count - Row count value.
 * @param approximate - Whether the count is an estimate.
 * @returns Localized string, optionally prefixed with "~".
 */
export function formatRowCount(count: number, approximate: boolean): string {
  const formatted = count.toLocaleString();
  return approximate ? `~${formatted}` : formatted;
}
