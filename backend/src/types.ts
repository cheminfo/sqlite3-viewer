/**
 * Shared HTTP contract between the Fastify plugin and the React component.
 * Kept intentionally duplicated in `frontend/src/types.ts`; the surface is
 * tiny and review-time diff is enough to catch drift.
 */

/** Column metadata returned by `PRAGMA table_info` (or derived from a row). */
export interface TableColumn {
  name: string;
  type: string;
}

/** One entry in the `GET /tables` response. */
export interface TableInfo {
  name: string;
  type: string;
  rowCount: number;
  /** True when `rowCount` is an estimate, not an exact count. */
  approximate: boolean;
  columns: TableColumn[];
}

/** Response shape for `GET /tables`. */
export interface TablesResponse {
  tables: TableInfo[];
}

/** Response shape for `GET /tables/:tableName`. */
export interface TableRowsResponse {
  tableName: string;
  columns: string[];
  /**
   * The page. An INTEGER outside ±(2^53 − 1), which a JavaScript number
   * cannot hold exactly, comes as its exact decimal string.
   */
  rows: Array<Record<string, unknown>>;
  /** With a `search`, the matches in the scanned rows; otherwise the fast row count. */
  total: number;
  /**
   * True when `total` is an estimate: a `sqlite_stat1` or `sqlite_sequence`
   * count, or a `search` that did not cover the whole table.
   */
  approximate: boolean;
  /** Rows the `search` examined, from the start of the table; `0` without a `search`. */
  scanned: number;
  /**
   * False when the `search` stopped at `maxScanRows` before the end of the
   * table; `true` without a `search`.
   */
  complete: boolean;
  limit: number;
  offset: number;
  /** Largest `offset` the server accepts; past it the route answers 400. */
  maxOffset: number;
}
