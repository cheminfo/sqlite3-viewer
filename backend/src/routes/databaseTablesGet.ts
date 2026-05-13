import type { DatabaseSync } from 'node:sqlite';

import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

import type { ExactCountFn } from '../fastCount.ts';
import { loadFastCountSources, resolveFastCount } from '../fastCount.ts';
import type { TableInfo, TablesResponse } from '../types.ts';

interface RegisterOptions {
  db: DatabaseSync;
  exactCountOverrides?: Record<string, ExactCountFn>;
  preHandler?: preHandlerHookHandler;
}

/**
 * Register `GET /tables` — list all real tables with row counts and column info.
 *
 * Views are intentionally excluded: counting rows in a view forces SQLite to
 * materialize the full query, which freezes on large databases.
 *
 * Row counts are resolved via `resolveFastCount`, which never runs
 * `SELECT COUNT(*)` and always returns in O(1).
 * @param fastify - Fastify instance.
 * @param options - DB connection plus optional exact-count overrides and auth handler.
 */
export function registerDatabaseTablesGet(
  fastify: FastifyInstance,
  options: RegisterOptions,
): void {
  const { db, exactCountOverrides, preHandler } = options;

  fastify.get('/tables', { preHandler }, (): TablesResponse => {
    const objects = db
      .prepare(
        `SELECT name, type FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      )
      .all() as Array<{ name: string; type: string }>;

    const sources = loadFastCountSources(db);

    const tables: TableInfo[] = [];
    for (const object of objects) {
      const { rowCount, approximate } = resolveFastCount(
        db,
        object.name,
        sources,
        exactCountOverrides,
      );

      let columns: Array<{ name: string; type: string }> = [];
      try {
        columns = db
          .prepare(`PRAGMA table_info("${object.name}")`)
          .all() as Array<{ name: string; type: string }>;
      } catch {
        // Ignore — table may have been dropped between the listing and pragma.
      }

      tables.push({
        name: object.name,
        type: object.type,
        rowCount,
        approximate,
        columns: columns.map((column) => ({
          name: column.name,
          type: column.type,
        })),
      });
    }

    return { tables };
  });
}
