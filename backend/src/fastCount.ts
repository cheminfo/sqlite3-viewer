import type { DatabaseSync } from 'node:sqlite';

/** Resolved row count along with whether it is exact or approximate. */
export interface FastCountResult {
  rowCount: number;
  approximate: boolean;
}

/**
 * Caller-supplied exact count function for a specific table. Returning
 * `null` means "I cannot answer right now, fall through to the next tier".
 */
export type ExactCountFn = (db: DatabaseSync) => number | null;

/**
 * Pre-loaded `sqlite_stat1` and `sqlite_sequence` data, keyed by table name.
 * Load once per request and reuse across multiple `resolveFastCount` calls.
 */
export interface FastCountSources {
  stat1Counts: Map<string, number>;
  sequenceCounts: Map<string, number>;
}

/**
 * Pre-load `sqlite_stat1` estimates and `sqlite_sequence` max ids for the
 * whole database. The two tables are each read with a single query, so this
 * is cheap even on large databases and avoids N per-table lookups later.
 * @param db - Raw database connection.
 * @returns Maps keyed by table name for both stats sources.
 */
export function loadFastCountSources(db: DatabaseSync): FastCountSources {
  const stat1Counts = new Map<string, number>();
  try {
    const statRows = db
      .prepare(`SELECT tbl, stat FROM sqlite_stat1`)
      .all() as Array<{ tbl: string; stat: string | null }>;
    for (const row of statRows) {
      if (!row.stat) continue;
      const firstToken = row.stat.split(' ', 1)[0];
      if (!firstToken) continue;
      const parsed = Number.parseInt(firstToken, 10);
      if (Number.isFinite(parsed) && !stat1Counts.has(row.tbl)) {
        stat1Counts.set(row.tbl, parsed);
      }
    }
  } catch {
    // `sqlite_stat1` does not exist until ANALYZE has been run at least once.
  }

  const sequenceCounts = new Map<string, number>();
  try {
    const seqRows = db
      .prepare(`SELECT name, seq FROM sqlite_sequence`)
      .all() as Array<{ name: string; seq: number }>;
    for (const row of seqRows) {
      sequenceCounts.set(row.name, row.seq);
    }
  } catch {
    // `sqlite_sequence` only exists if at least one AUTOINCREMENT table exists.
  }

  return { stat1Counts, sequenceCounts };
}

/**
 * Resolve a fast row count for a single table using a tiered strategy:
 *
 * 1. Caller-supplied `exactCountOverrides[tableName]` — exact, O(1) when
 *    backed by a trigger-maintained stats table.
 * 2. `sqlite_stat1` estimate — approximate, O(1), requires ANALYZE.
 * 3. `sqlite_sequence` max autoincrement id — approximate upper bound, O(1).
 * 4. `0` with `approximate: true` if nothing is available.
 *
 * Never runs `SELECT COUNT(*)`: on a TB-scale database that walks the full
 * rowid b-tree and can take many seconds per table.
 * @param db - Raw database connection.
 * @param tableName - Name of the table to count.
 * @param sources - Pre-loaded stats sources from `loadFastCountSources`.
 * @param exactCountOverrides - Optional per-table exact count functions.
 * @returns Row count and whether it is an estimate.
 */
export function resolveFastCount(
  db: DatabaseSync,
  tableName: string,
  sources: FastCountSources,
  exactCountOverrides?: Record<string, ExactCountFn>,
): FastCountResult {
  const exactFn = exactCountOverrides?.[tableName];
  if (exactFn) {
    try {
      const exact = exactFn(db);
      if (exact !== null) {
        return { rowCount: exact, approximate: false };
      }
    } catch {
      // Fall through to estimation tiers.
    }
  }

  const statEstimate = sources.stat1Counts.get(tableName);
  if (statEstimate !== undefined) {
    return { rowCount: statEstimate, approximate: true };
  }

  const seqEstimate = sources.sequenceCounts.get(tableName);
  if (seqEstimate !== undefined) {
    return { rowCount: seqEstimate, approximate: true };
  }

  return { rowCount: 0, approximate: true };
}
