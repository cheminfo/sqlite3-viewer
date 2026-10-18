/**
 * Count the pages a pager can open when the server refuses an offset above
 * `maxOffset`. Page `n` starts at offset `(n - 1) * pageSize`.
 * @param maxOffset - Largest offset the server accepts.
 * @param pageSize - Rows per page.
 * @returns The number of reachable pages, at least 1.
 */
export function reachablePageCount(
  maxOffset: number,
  pageSize: number,
): number {
  return Math.floor(maxOffset / pageSize) + 1;
}
