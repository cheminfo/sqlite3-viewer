import { DatabaseSync } from 'node:sqlite';

import Fastify from 'fastify';
import { expect, onTestFinished, test, vi } from 'vitest';

import { sqliteViewerPlugin } from '../index.ts';

test('a failing PRAGMA optimize is logged as a warning, never thrown', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const db = new DatabaseSync(':memory:');
  // Every exec on a closed connection throws, as one can on a read-only or
  // busy connection.
  db.close();
  const lines: string[] = [];
  const fastify = Fastify({
    logger: {
      level: 'warn',
      stream: {
        write: (line) => {
          lines.push(line);
        },
      },
    },
  });

  await fastify.register(sqliteViewerPlugin, { db, optimizeIntervalMs: 1000 });
  await fastify.ready();
  vi.advanceTimersByTime(2000);
  await fastify.close();

  const warnings = lines.map((line) => {
    const { level, msg, err } = JSON.parse(line) as {
      level: number;
      msg: string;
      err: { message: string };
    };
    return { level, msg, error: err.message };
  });
  const warning = {
    level: 40,
    msg: 'PRAGMA optimize failed',
    error: 'database is not open',
  };

  // Once on ready, then once per elapsed interval.
  expect(warnings).toStrictEqual([warning, warning, warning]);
});
