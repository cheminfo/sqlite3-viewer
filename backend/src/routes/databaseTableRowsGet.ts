import type { DatabaseSync } from 'node:sqlite';

import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

import type { ExactCountFn } from '../fastCount.ts';
import { toJsonSafeInteger } from '../integers.ts';
import { readTablePage, searchTablePage } from '../tablePage.ts';
import type { TableRowsResponse } from '../types.ts';

/** Allowed table name pattern to prevent SQL injection. */
const TABLE_NAME_PATTERN = /^[\w]+$/;

interface RegisterOptions {
  db: DatabaseSync;
  exactCountOverrides?: Record<string, ExactCountFn>;
  maxScanRows: number;
  maxOffset: number;
  preHandler?: preHandlerHookHandler;
}

/**
 * Register `GET /tables/:tableName` — browse rows of a specific table.
 * Supports pagination via `limit` and `offset` (at most `maxOffset`), and a
 * `search` across all columns of the first `maxScanRows` rows.
 * @param fastify - Fastify instance.
 * @param options - DB connection, scan and offset bounds, plus optional
 *   exact-count overrides and auth handler.
 */
export function registerDatabaseTableRowsGet(
  fastify: FastifyInstance,
  options: RegisterOptions,
): void {
  const { db, exactCountOverrides, maxScanRows, maxOffset, preHandler } =
    options;

  fastify.get<{
    Params: { tableName: string };
    Querystring: {
      limit?: string;
      offset?: string;
      search?: string;
    };
  }>('/tables/:tableName', { preHandler }, (request, reply) => {
    const { tableName } = request.params;

    if (!TABLE_NAME_PATTERN.test(tableName)) {
      return reply.status(400).send({ error: 'Invalid table name' });
    }

    const tableExists = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE name = ? AND type IN ('table', 'view')`,
      )
      .get(tableName) as { name: string } | undefined;

    if (!tableExists) {
      return reply.status(404).send({ error: 'Table not found' });
    }

    const limit = Math.min(Number(request.query.limit) || 50, 500);
    const offset = Number(request.query.offset) || 0;
    // SQLite walks every row an OFFSET skips, so a large one costs a scan.
    if (offset > maxOffset) {
      return reply.status(400).send({
        error: `Offset ${offset} is above the maximum of ${maxOffset}`,
      });
    }
    const searchQuery = request.query.search?.trim() ?? '';

    const searchColumns = readColumnNames(db, tableName);

    const { rows, total, approximate, scanned, complete } =
      searchQuery && searchColumns.length > 0
        ? searchTablePage(db, tableName, searchColumns, {
            search: searchQuery,
            limit,
            offset,
            maxScanRows,
          })
        : readTablePage(db, tableName, { limit, offset, exactCountOverrides });

    const columnNames =
      searchColumns.length > 0
        ? searchColumns
        : rows.length > 0
          ? Object.keys(rows[0] as Record<string, unknown>)
          : [];

    const processedRows = processRows(rows, columnNames);

    const response: TableRowsResponse = {
      tableName,
      columns: columnNames,
      rows: processedRows,
      total,
      approximate,
      scanned,
      complete,
      limit,
      offset,
      maxOffset,
    };
    return response;
  });
}

/**
 * Read the column names of a table or view, falling back to `table_xinfo`
 * for virtual tables that hide their columns from `table_info`.
 * @param db - Database connection.
 * @param tableName - Validated table name (already matched against the safe pattern).
 * @returns Array of column names, or `[]` if neither pragma succeeds.
 */
function readColumnNames(db: DatabaseSync, tableName: string): string[] {
  try {
    const columnInfo = db
      .prepare(`PRAGMA table_info("${tableName}")`)
      .all() as Array<{ name: string }>;
    if (columnInfo.length > 0) return columnInfo.map((column) => column.name);
  } catch {
    // Fall through to `table_xinfo`.
  }
  try {
    const columnInfo = db
      .prepare(`PRAGMA table_xinfo("${tableName}")`)
      .all() as Array<{ name: string }>;
    return columnInfo.map((column) => column.name);
  } catch {
    return [];
  }
}

/**
 * Turn bigints into numbers or exact decimal strings, decode BLOB columns as
 * UTF-8 (and JSON-parse them if they look like JSON), and JSON-parse text
 * columns whose value is a JSON object/array literal. Unmatched values are
 * passed through unchanged.
 * @param rows - Raw rows, read with `setReadBigInts(true)`.
 * @param columnNames - Column names to project, in order.
 * @returns New rows with bigints converted, BLOBs decoded and JSON strings
 *   parsed.
 */
function processRows(
  rows: Array<Record<string, unknown>>,
  columnNames: string[],
): Array<Record<string, unknown>> {
  const processed = new Array<Record<string, unknown>>(rows.length);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] as Record<string, unknown>;
    const processedRow: Record<string, unknown> = {};
    for (const key of columnNames) {
      let value = row[key];
      if (typeof value === 'bigint') {
        value = toJsonSafeInteger(value);
      } else if (value instanceof ArrayBuffer || value instanceof Uint8Array) {
        try {
          const buffer =
            value instanceof Uint8Array ? value : new Uint8Array(value);
          const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
          try {
            value = JSON.parse(text);
          } catch {
            value = text;
          }
        } catch {
          const byteLength = value.byteLength;
          value = `[BLOB ${String(byteLength)} bytes]`;
        }
      } else if (
        typeof value === 'string' &&
        ((value.startsWith('{') && value.endsWith('}')) ||
          (value.startsWith('[') && value.endsWith(']')))
      ) {
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string.
        }
      }
      processedRow[key] = value;
    }
    processed[rowIndex] = processedRow;
  }
  return processed;
}
