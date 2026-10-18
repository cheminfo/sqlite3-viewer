import { DatabaseSync } from 'node:sqlite';

import Fastify from 'fastify';
import { expect, test } from 'vitest';

import { sqliteViewerPlugin } from '../index.ts';
import type { TableRowsResponse } from '../types.ts';

import { buildViewer } from './buildViewer.ts';

/**
 * Open an in-memory database whose `items` table holds rows `1..count`,
 * labelled `even` or `odd` after their id.
 * @param count - Number of rows.
 * @returns The connection.
 */
function openItems(count: number) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, label TEXT)');
  const insert = db.prepare('INSERT INTO items VALUES (?, ?)');
  for (let id = 1; id <= count; id++) {
    insert.run(id, id % 2 === 0 ? 'even' : 'odd');
  }
  return db;
}

test('a search reads only the first maxScanRows rows', async () => {
  const fastify = await buildViewer(openItems(25), { maxScanRows: 10 });
  const response = await fastify.inject({
    method: 'GET',
    url: '/db/tables/items?search=even&limit=3&offset=1',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json<TableRowsResponse>()).toStrictEqual({
    tableName: 'items',
    columns: ['id', 'label'],
    rows: [
      { id: 4, label: 'even' },
      { id: 6, label: 'even' },
      { id: 8, label: 'even' },
    ],
    // Ids 2, 4, 6, 8 and 10: the even ids past 10 lie outside the window.
    total: 5,
    approximate: true,
    scanned: 10,
    complete: false,
    limit: 3,
    offset: 1,
    maxOffset: 100_000,
  });
});

test('a search over a table no larger than maxScanRows is complete', async () => {
  const fastify = await buildViewer(openItems(10), { maxScanRows: 10 });
  const response = await fastify.inject({
    method: 'GET',
    url: '/db/tables/items?search=odd',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json<TableRowsResponse>()).toStrictEqual({
    tableName: 'items',
    columns: ['id', 'label'],
    rows: [
      { id: 1, label: 'odd' },
      { id: 3, label: 'odd' },
      { id: 5, label: 'odd' },
      { id: 7, label: 'odd' },
      { id: 9, label: 'odd' },
    ],
    total: 5,
    approximate: false,
    scanned: 10,
    complete: true,
    limit: 50,
    offset: 0,
    maxOffset: 100_000,
  });
});

test('without a search, rows past maxScanRows are browsed with the fast count', async () => {
  const db = openItems(25);
  db.exec('ANALYZE');
  const fastify = await buildViewer(db, { maxScanRows: 10 });
  const response = await fastify.inject({
    method: 'GET',
    url: '/db/tables/items?limit=2&offset=20',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json<TableRowsResponse>()).toStrictEqual({
    tableName: 'items',
    columns: ['id', 'label'],
    rows: [
      { id: 21, label: 'odd' },
      { id: 22, label: 'even' },
    ],
    // The `sqlite_stat1` estimate, not a count.
    total: 25,
    approximate: true,
    scanned: 0,
    complete: true,
    limit: 2,
    offset: 20,
    maxOffset: 100_000,
  });
});

test('an offset past maxOffset is refused with 400', async () => {
  const fastify = await buildViewer(openItems(25), { maxOffset: 10 });
  const atMaximum = await fastify.inject({
    method: 'GET',
    url: '/db/tables/items?limit=2&offset=10',
  });
  const pastMaximum = await fastify.inject({
    method: 'GET',
    url: '/db/tables/items?limit=2&offset=11',
  });
  const atMaximumBody = atMaximum.json<TableRowsResponse>();

  expect(atMaximum.statusCode).toBe(200);
  expect(atMaximumBody.rows).toStrictEqual([
    { id: 11, label: 'odd' },
    { id: 12, label: 'even' },
  ]);
  expect(atMaximumBody.maxOffset).toBe(10);
  expect(pastMaximum.statusCode).toBe(400);
  expect(pastMaximum.json()).toStrictEqual({
    error: 'Offset 11 is above the maximum of 10',
  });
});

test('a row bound that is not a non-negative integer is refused at registration', async () => {
  const db = new DatabaseSync(':memory:');

  await expect(
    Fastify().register(sqliteViewerPlugin, { db, maxScanRows: Infinity }),
  ).rejects.toThrow('maxScanRows must be a non-negative integer, got Infinity');
  await expect(
    Fastify().register(sqliteViewerPlugin, { db, maxOffset: -1 }),
  ).rejects.toThrow('maxOffset must be a non-negative integer, got -1');
});
