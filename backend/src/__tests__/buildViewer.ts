import type { DatabaseSync } from 'node:sqlite';

import Fastify from 'fastify';
import { onTestFinished } from 'vitest';

import type { SqliteViewerPluginOptions } from '../index.ts';
import { sqliteViewerPlugin } from '../index.ts';

/**
 * Build a ready Fastify instance serving the plugin at `/db`, closed when the
 * calling test finishes. `PRAGMA optimize` is off unless a test asks for it.
 * @param db - Database the plugin browses.
 * @param options - Plugin options other than `db`.
 * @returns The ready instance.
 */
export async function buildViewer(
  db: DatabaseSync,
  options: Omit<SqliteViewerPluginOptions, 'db'> = {},
) {
  const fastify = Fastify();
  onTestFinished(async () => {
    await fastify.close();
  });
  await fastify.register(sqliteViewerPlugin, {
    optimizeIntervalMs: 0,
    ...options,
    db,
    prefix: '/db',
  });
  await fastify.ready();
  return fastify;
}
