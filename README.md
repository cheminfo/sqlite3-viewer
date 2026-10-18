# sqlite3-viewer

Pluggable, read-only SQLite database viewer, shipped as **two npm packages from one repo** so a host application can adopt the backend, the frontend, or both.

| Package                                 | What it does                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`sqlite3-viewer-backend`](./backend)   | Fastify plugin exposing `/tables`, `/tables/:name`, and `/schema` against a `node:sqlite` `DatabaseSync` connection. |
| [`sqlite3-viewer-frontend`](./frontend) | React + Blueprint component (`<DatabaseBrowserPanel />`) that browses any database served by the plugin.             |

The two packages talk to each other only through the four HTTP endpoints; either side can be used independently.

## Why two packages?

The backend depends on `fastify` and `node:sqlite` (Node-only). The frontend depends on `react` and `@blueprintjs/core` (browser). Bundling them together would force every backend host to install Blueprint, or every frontend host to ship `node:sqlite`. Splitting them keeps each consumer's dependency graph clean. They are versioned in lockstep via release-please.

The HTTP contract is duplicated as a tiny [`types.ts`](./backend/src/types.ts) on each side rather than extracted into a third package — the surface is small enough that review-time diff is sufficient to catch drift.

## Backend usage

```ts
import { DatabaseSync } from 'node:sqlite';
import Fastify from 'fastify';
import { sqliteViewerPlugin } from 'sqlite3-viewer-backend';

const db = new DatabaseSync('data/sqlite/app.db');
const fastify = Fastify();

await fastify.register(sqliteViewerPlugin, {
  db,
  // prefix: '/v1/database',                  // optional — this is the default
  schemaSvgPath: 'schema/schema.svg', // optional
  exactCountOverrides: {
    // Optional — bypass sqlite_stat1 with a trigger-maintained stats table.
    tasks: (database) =>
      (
        database
          .prepare('SELECT COALESCE(SUM(count), 0) AS n FROM task_stats')
          .get() as { n: number }
      ).n,
  },
  // Optional — run PRAGMA optimize every 15 min (default). Set to 0 to disable.
  optimizeIntervalMs: 15 * 60 * 1000,
  // Optional — a search examines the first 100,000 rows (default).
  maxScanRows: 100_000,
  // Optional — the largest offset accepted (default); past it the route answers 400.
  maxOffset: 100_000,
  preHandler: (request, reply, done) => {
    // Optional — gate the routes behind the host app's auth middleware.
    if (!request.session) reply.code(401).send({ error: 'Unauthorized' });
    else done();
  },
});

await fastify.listen({ port: 3000 });
```

### Options

| Option                | Default           | Description                                                                                                                    |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `db`                  | required          | Open `node:sqlite` connection. The plugin never opens, closes or writes to it, so a read-only connection works.                |
| `prefix`              | `/v1/database`    | Fastify register option: where the routes mount.                                                                               |
| `schemaSvgPath`       | none              | Schema SVG served at `/schema`. Without it, `/schema` answers 404.                                                             |
| `exactCountOverrides` | none              | Exact count per table, tried before the estimates (see below).                                                                 |
| `optimizeIntervalMs`  | `900000` (15 min) | How often `PRAGMA optimize` runs; it also runs once on ready. `0` disables it. A failure is logged as a warning, never thrown. |
| `maxScanRows`         | `100000`          | Rows a `search` examines, from the start of the table in its natural order.                                                    |
| `maxOffset`           | `100000`          | Largest `offset` the rows route accepts. Past it the route answers 400.                                                        |
| `preHandler`          | none              | Fastify pre-handler run before every route, e.g. the host's auth.                                                              |

`maxScanRows` and `maxOffset` must be non-negative integers; any other value fails the registration.

### Endpoints (mounted under `prefix`, default `/v1/database`)

| Method | Path                 | Description                                                                                                                       |
| ------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/tables`            | List real tables with column info and a fast row count (never `COUNT(*)`).                                                        |
| `GET`  | `/tables/:tableName` | Browse rows. Query: `limit` (≤500), `offset` (≤ `maxOffset`), `search` (LIKE across all columns of the first `maxScanRows` rows). |
| `GET`  | `/schema`            | Serve a hand-crafted schema SVG. Returns 404 when no `schemaSvgPath` is configured.                                               |

### Rows response

`GET /tables/:tableName` answers:

| Field                  | Meaning                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `tableName`, `columns` | The table and its column names, in order.                                                                                   |
| `rows`                 | The page. An INTEGER outside ±(2^53 − 1), which a JavaScript number cannot hold exactly, comes as its exact decimal string. |
| `total`                | With `search`, the matches among the scanned rows. Without, the fast row count.                                             |
| `approximate`          | `true` when `total` is an estimate, or when the search did not cover the whole table.                                       |
| `scanned`              | Rows the search examined. `0` without `search`.                                                                             |
| `complete`             | `false` when the search stopped at `maxScanRows` before the end of the table. `true` without `search`.                      |
| `limit`, `offset`      | The page bounds applied.                                                                                                    |
| `maxOffset`            | Largest `offset` the route accepts.                                                                                         |

### Row counts are O(1)

The plugin never runs an unbounded `SELECT COUNT(*)` — at TB scale that walks the full b-tree. Instead it tries, in order:

1. A caller-supplied `exactCountOverrides[tableName]` (typically a trigger-maintained stats table).
2. The `sqlite_stat1` estimate (requires `ANALYZE`).
3. The `sqlite_sequence` max autoincrement id (upper bound).
4. `0` with `approximate: true` if nothing else is available.

Counts marked `approximate: true` are rendered with a `~` prefix in the UI.

A `search` counts its matches among the first `maxScanRows` rows only, so it costs the same on a table of any size. When that window ends before the table does, `complete` is `false`, `total` is approximate, and the UI says how many rows it searched.

Paging is bounded the same way. SQLite walks every row an `OFFSET` skips, so the route refuses an `offset` above `maxOffset`, and the pager stops at the last page it can reach.

## Frontend usage

```tsx
import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import { DatabaseBrowserPanel } from 'sqlite3-viewer-frontend';

export function DatabasePage() {
  return <DatabaseBrowserPanel apiBasePath="/v1/database" />;
}
```

Pass a custom `fetcher` to inject auth headers (e.g. a session bearer token):

```tsx
<DatabaseBrowserPanel
  apiBasePath="/v1/database"
  fetcher={(input, init) =>
    fetch(input, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    })
  }
/>
```

## Schema diagram

If the backend is configured with `schemaSvgPath`, the frontend renders the SVG inline above the table list. To make tables clickable from the diagram, mark each table group in the SVG with `data-table="<table-name>"`; the frontend uses event delegation to wire clicks to the table-list selection. The `database-schema-svg` skill in this org generates SVGs in exactly this shape.

## Development

```sh
npm install
npm run test          # type-check + lint + prettier + tests across both workspaces
npm run eslint-fix
npm run prettier-write
```

Each workspace has its own `tsc` build that emits to `lib/`; `prepack` runs it automatically before `npm publish`.

## License

MIT
