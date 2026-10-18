import type { DatabaseSync, SQLInputValue, StatementSync } from 'node:sqlite';

import type { ExactCountFn } from './fastCount.ts';
import { loadFastCountSources, resolveFastCount } from './fastCount.ts';

/** One page of a table, before its values are shaped for JSON. */
export interface TablePage {
  /** Raw rows, with every INTEGER read as a bigint. */
  rows: Array<Record<string, unknown>>;
  /** Matches in the scanned rows with a search; otherwise the fast count. */
  total: number;
  /** True when `total` is an estimate. */
  approximate: boolean;
  /** Rows the search examined; `0` without a search. */
  scanned: number;
  /** False when the search stopped before the end of the table. */
  complete: boolean;
}

/** Options for `readTablePage`. */
export interface ReadTablePageOptions {
  limit: number;
  offset: number;
  /**
   * Per-table exact-count functions, tried before the estimates.
   * @default undefined
   */
  exactCountOverrides?: Record<string, ExactCountFn>;
}

/**
 * Read one page of a table without a filter. The total comes from the tiered
 * fast count, never `COUNT(*)`: counting a 10 TB table would freeze the panel.
 * @param db - Database connection.
 * @param tableName - Validated table name.
 * @param options - Page bounds and optional exact-count overrides.
 * @returns The page; `scanned` is `0` and `complete` is `true`, since no
 *   search ran.
 */
export function readTablePage(
  db: DatabaseSync,
  tableName: string,
  options: ReadTablePageOptions,
): TablePage {
  const { limit, offset, exactCountOverrides } = options;
  const { rowCount, approximate } = resolveFastCount(
    db,
    tableName,
    loadFastCountSources(db),
    exactCountOverrides,
  );
  const rows = readRows(
    db.prepare(`SELECT * FROM ${quoteIdentifier(tableName)} LIMIT ? OFFSET ?`),
    [limit, offset],
  );
  return { rows, total: rowCount, approximate, scanned: 0, complete: true };
}

/** Options for `searchTablePage`. */
export interface SearchTablePageOptions {
  /** Text looked for in every column, as a `LIKE` substring. */
  search: string;
  limit: number;
  offset: number;
  /** Rows examined, from the start of the table. */
  maxScanRows: number;
}

/**
 * Read one page of the rows matching `search` in any column, among the first
 * `maxScanRows` rows of the table in its natural order. Every query stops at
 * that window, so a search costs the same on a table of any size.
 * @param db - Database connection.
 * @param tableName - Validated table name.
 * @param columns - Columns to search, as read from the table.
 * @param options - Search text, page bounds and scan window.
 * @returns The page, the matches in the window, and whether the window
 *   covered the whole table.
 */
export function searchTablePage(
  db: DatabaseSync,
  tableName: string,
  columns: string[],
  options: SearchTablePageOptions,
): TablePage {
  const { search, limit, offset, maxScanRows } = options;
  const table = quoteIdentifier(tableName);
  const pattern = `%${search}%`;
  const conditions = columns.map(
    (column) => `CAST(${quoteIdentifier(column)} AS TEXT) LIKE ?`,
  );
  const matches = `(SELECT * FROM ${table} LIMIT ?) WHERE ${conditions.join(' OR ')}`;
  const params: SQLInputValue[] = [maxScanRows, ...columns.map(() => pattern)];

  const total = readCount(
    db.prepare(`SELECT count(*) AS count FROM ${matches}`),
    params,
  );
  // Counting one row past the window tells whether it reached the end.
  const windowRows = readCount(
    db.prepare(
      `SELECT count(*) AS count FROM (SELECT 1 FROM ${table} LIMIT ?)`,
    ),
    [maxScanRows + 1],
  );
  const rows = readRows(
    db.prepare(`SELECT * FROM ${matches} LIMIT ? OFFSET ?`),
    [...params, limit, offset],
  );
  const complete = windowRows <= maxScanRows;
  return {
    rows,
    total,
    approximate: !complete,
    scanned: Math.min(windowRows, maxScanRows),
    complete,
  };
}

/**
 * Read every row of a statement with INTEGER values as bigints, so a 64-bit
 * value neither throws nor loses digits.
 * @param statement - Prepared statement.
 * @param params - Values bound to its placeholders.
 * @returns The raw rows.
 */
function readRows(
  statement: StatementSync,
  params: SQLInputValue[],
): Array<Record<string, unknown>> {
  statement.setReadBigInts(true);
  return statement.all(...params);
}

/**
 * Read the `count` column of a single-row statement. Bigints are switched on
 * explicitly, so a connection opened with `readBigInts` cannot put one in the
 * response.
 * @param statement - Prepared `SELECT count(*) AS count …` statement.
 * @param params - Values bound to its placeholders.
 * @returns The count. It never exceeds `maxScanRows + 1`, a safe integer, so
 *   the number is exact.
 */
function readCount(statement: StatementSync, params: SQLInputValue[]): number {
  statement.setReadBigInts(true);
  const row = statement.get(...params) as { count: bigint };
  return Number(row.count);
}

/**
 * Quote an SQL identifier, doubling any double quote inside it.
 * @param name - Table or column name.
 * @returns The quoted identifier.
 */
function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}
