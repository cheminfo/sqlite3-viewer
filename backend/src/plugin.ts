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
const DEFAULT_OPTIMIZE_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_SCAN_ROWS = 100_000;
const DEFAULT_MAX_OFFSET = 100_000;

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
   * Interval in milliseconds at which `PRAGMA optimize` is run to keep
   * `sqlite_stat1` fresh for the query planner and row-count estimates.
   * The pragma also runs once immediately on server ready.
   * Set to `0` to disable periodic optimization entirely.
   * A failure, e.g. on a read-only or busy connection, is logged as a
   * warning and never thrown.
   * @default 900000
   */
  optimizeIntervalMs?: number;
  /**
   * Rows a `search` examines, read from the start of the table in its
   * natural order. Both the count and the page stop at this window, so a
   * search costs the same on a table of any size; the response says whether
   * the window covered the whole table.
   * @default 100000
   */
  maxScanRows?: number;
  /**
   * Largest `offset` the rows route accepts; a request past it answers 400.
   * SQLite walks every skipped row, so a large offset costs a table scan.
   * @default 100000
   */
  maxOffset?: number;
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
  const {
    db,
    schemaSvgPath,
    exactCountOverrides,
    preHandler,
    optimizeIntervalMs = DEFAULT_OPTIMIZE_INTERVAL_MS,
  } = options;
  const maxScanRows = resolveRowBound(
    'maxScanRows',
    options.maxScanRows,
    DEFAULT_MAX_SCAN_ROWS,
  );
  const maxOffset = resolveRowBound(
    'maxOffset',
    options.maxOffset,
    DEFAULT_MAX_OFFSET,
  );

  if (optimizeIntervalMs > 0) {
    // A throw inside the interval would be an uncaught exception that ends
    // the host process.
    const runOptimize = () => {
      try {
        db.exec('PRAGMA optimize');
      } catch (error) {
        fastify.log.warn({ err: error }, 'PRAGMA optimize failed');
      }
    };
    fastify.addHook('onReady', async () => {
      runOptimize();
    });
    const timer = setInterval(runOptimize, optimizeIntervalMs);
    fastify.addHook('onClose', async () => {
      clearInterval(timer);
    });
  }

  const registerRoutes = (instance: FastifyInstance) => {
    registerDatabaseTablesGet(instance, {
      db,
      exactCountOverrides,
      preHandler,
    });
    registerDatabaseTableRowsGet(instance, {
      db,
      exactCountOverrides,
      maxScanRows,
      maxOffset,
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

/**
 * Resolve a row bound, refusing a value SQLite cannot bind as a `LIMIT` and
 * JSON cannot carry, such as `Infinity`.
 * @param name - Option name, for the error message.
 * @param value - Value the host passed, if any.
 * @param fallback - Default used when the host passed nothing.
 * @returns The bound to apply.
 */
function resolveRowBound(
  name: string,
  value: number | undefined,
  fallback: number,
): number {
  const bound = value ?? fallback;
  if (!Number.isSafeInteger(bound) || bound < 0) {
    throw new RangeError(
      `${name} must be a non-negative integer, got ${String(bound)}`,
    );
  }
  return bound;
}
