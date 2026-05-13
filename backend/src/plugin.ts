import type { DatabaseSync } from 'node:sqlite';

import type {
  FastifyInstance,
  FastifyPluginAsync,
  preHandlerHookHandler,
} from 'fastify';

import type { ExactCountFn } from './fastCount.ts';
import { registerDatabaseSchemaGet } from './routes/databaseSchemaGet.ts';
import { registerDatabaseTableRowsGet } from './routes/databaseTableRowsGet.ts';
import { registerDatabaseTablesGet } from './routes/databaseTablesGet.ts';

const DEFAULT_PREFIX = '/v1/database';

/** Options for `sqliteViewerPlugin`. */
export interface SqliteViewerPluginOptions {
  /**
   * Open `node:sqlite` connection used for every query. The plugin never
   * opens, closes, or writes to the database.
   */
  db: DatabaseSync;
  /**
   * Optional path to a hand-crafted schema SVG (entity-relationship view).
   * When omitted, `GET /schema` responds with 404 and the React component
   * hides the diagram panel.
   * @default undefined
   */
  schemaSvgPath?: string;
  /**
   * Per-table exact-count functions, queried before falling back to
   * `sqlite_stat1` / `sqlite_sequence` estimates. Use this to plug in
   * trigger-maintained stats tables — e.g.
   * `tasks: (db) => db.prepare('SELECT SUM(count) AS n FROM task_stats').get().n`.
   * @default undefined
   */
  exactCountOverrides?: Record<string, ExactCountFn>;
  /**
   * Optional Fastify pre-handler applied to every route in this plugin.
   * Use it to require auth before exposing the database to clients.
   * @default undefined
   */
  preHandler?: preHandlerHookHandler;
}

/**
 * Fastify plugin exposing read-only SQLite browse endpoints:
 *
 * - `GET /tables` — list tables with fast row counts and column info.
 * - `GET /tables/:tableName` — paginated rows with optional search.
 * - `GET /schema` — serve a schema SVG (404 when none is configured).
 *
 * Routes mount under `/v1/database` by default. Pass `prefix` to
 * `fastify.register(sqliteViewerPlugin, { db, prefix: '/foo' })` to mount
 * them somewhere else.
 * @param fastify - Fastify instance.
 * @param options - Plugin options; see `SqliteViewerPluginOptions`.
 */
export const sqliteViewerPlugin: FastifyPluginAsync<
  SqliteViewerPluginOptions
> = async (fastify, options) => {
  const { db, schemaSvgPath, exactCountOverrides, preHandler } = options;

  const registerRoutes = (instance: FastifyInstance) => {
    registerDatabaseTablesGet(instance, {
      db,
      exactCountOverrides,
      preHandler,
    });
    registerDatabaseTableRowsGet(instance, {
      db,
      exactCountOverrides,
      preHandler,
    });
    registerDatabaseSchemaGet(instance, { schemaSvgPath, preHandler });
  };

  // If the host didn't supply a `prefix` to `fastify.register(...)`, the
  // plugin's encapsulated prefix is the root. Apply the default prefix via
  // a nested register so consumers get sensible URLs out of the box.
  if (fastify.prefix === '/' || fastify.prefix === '') {
    await fastify.register(
      async (instance) => {
        registerRoutes(instance);
      },
      { prefix: DEFAULT_PREFIX },
    );
  } else {
    registerRoutes(fastify);
  }
};
