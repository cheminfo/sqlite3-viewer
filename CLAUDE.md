# sqlite3-viewer

Pluggable SQLite database browser published as two npm packages from one monorepo.

## Purpose

Extracted from the `cheminfo/pipeline` project so the database browser can be reused in any Fastify + React app that uses `node:sqlite`. The pipeline project consumes both packages.

## Packages

| Package                   | npm       | Path        |
| ------------------------- | --------- | ----------- |
| `sqlite3-viewer-backend`  | published | `backend/`  |
| `sqlite3-viewer-frontend` | published | `frontend/` |

## Architecture

**Backend** (`sqlite3-viewer-backend`): a Fastify plugin (`sqliteViewerPlugin`) that mounts three read-only routes under `/v1/database` by default:

- `GET /tables` — list all real tables with fast O(1) row counts and column info
- `GET /tables/:tableName` — paginated rows with optional full-text search
- `GET /schema` — serve a schema SVG (404 if not configured)

Row counting is O(1) via a tiered strategy: `exactCountOverrides` → `sqlite_stat1` → `sqlite_sequence` → 0. Never runs `SELECT COUNT(*)`.

**Frontend** (`sqlite3-viewer-frontend`): a React component (`DatabaseBrowserPanel`) built on BlueprintJS 6 and React 18. Takes `apiBasePath`, `fetcher` (for auth injection), and optional `pageSize`.

## Plugin options

```ts
interface SqliteViewerPluginOptions {
  db: DatabaseSync; // node:sqlite connection
  schemaSvgPath?: string; // path to schema SVG (optional)
  exactCountOverrides?: Record<string, ExactCountFn>; // trigger-maintained stats
  preHandler?: preHandlerHookHandler; // auth middleware
}
```

## How the pipeline uses it

In `backend/src/server/v1/v1.ts`:

```ts
fastify.register(sqliteViewerPlugin, {
  db: fastify.db.db,
  schemaSvgPath: join(import.meta.dirname, '../../../schema/schema.svg'),
  exactCountOverrides: {
    tasks: (db) =>
      db.prepare('SELECT COALESCE(SUM(count),0) AS total FROM task_stats').get()
        .total,
    runs: (db) =>
      db.prepare('SELECT COALESCE(SUM(count),0) AS total FROM run_stats').get()
        .total,
    molecules: (db) =>
      db
        .prepare('SELECT COALESCE(SUM(count),0) AS total FROM molecule_stats')
        .get().total,
  },
  preHandler: requireAuth, // pipeline's Bearer-token auth
});
```

In `frontend/src/App.tsx`:

```tsx
<DatabaseBrowserPanel
  apiBasePath="/v1/database"
  fetcher={authFetch} // injects Authorization: Bearer <token>
/>
```

The "Database" menu entry is hidden from logged-out users via `AUTH_TABS`.

## Tech stack

- **Runtime**: Node.js 22+ (uses `node:sqlite` — built-in, no third-party sqlite3 package)
- **Backend framework**: Fastify v5 (`FastifyPluginAsync`)
- **Frontend**: React 18, BlueprintJS 6
- **Build**: TypeScript ESM, compiled to `lib/` via `tsc`; `prepack` runs build before publish
- **Tests**: vitest 4.x with `pool: 'forks'` (required for `node:sqlite` resolution through Vite transforms)
- **Release**: release-please manifest (monorepo-aware, hand-written `release.yml` because the shared zakodium workflow reads only the root `package.json`)
- **CI**: zakodium shared Node.js workflow (`nodejs-v1`) with `disable-test-package: true` and `lint-check-types: true`

## Critical: registration pattern in Fastify

`sqliteViewerPlugin` must be registered with `fastify.register(...)` without `await` when called from a synchronous plugin/function. Fastify queues the plugin and processes it during `fastify.ready()`. Using `await fastify.register(...)` in a sync context (or in an async function that isn't itself awaited) will cause post-ready route registration failures.

## Releasing a new version

1. Merge PRs following conventional commits (`feat:`, `fix:`, `perf:`, `feat!:` for breaking)
2. release-please opens a release PR automatically
3. Merge the release PR → release-please creates the tag and GitHub release
4. The `publish` job in `.github/workflows/release.yml` runs `npm publish` for whichever workspace(s) changed
