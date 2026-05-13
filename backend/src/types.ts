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
  rows: Array<Record<string, unknown>>;
  total: number;
  /** True when `total` is an estimate (no `search` was supplied). */
  approximate: boolean;
  limit: number;
  offset: number;
}
