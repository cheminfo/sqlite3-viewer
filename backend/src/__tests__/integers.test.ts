import { DatabaseSync } from 'node:sqlite';

import { expect, test } from 'vitest';

import { toJsonSafeInteger } from '../integers.ts';
import type { TableRowsResponse, TablesResponse } from '../types.ts';

import { buildViewer } from './buildViewer.ts';

/**
 * Open an in-memory database whose `hashes` table holds one INTEGER a
 * JavaScript number can hold exactly and two it cannot.
 * @returns The connection.
 */
function openHashes() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE hashes (id INTEGER PRIMARY KEY, hash INTEGER);
    INSERT INTO hashes VALUES
      (1, 42), (2, 9007199254740993), (3, -5764607523034234880);
  `);
  return db;
}

test('toJsonSafeInteger keeps safe integers as numbers, the rest as exact strings', () => {
  expect(toJsonSafeInteger(9_007_199_254_740_991n)).toBe(9_007_199_254_740_991);
  expect(toJsonSafeInteger(-9_007_199_254_740_991n)).toBe(
    -9_007_199_254_740_991,
  );
  expect(toJsonSafeInteger(9_007_199_254_740_992n)).toBe('9007199254740992');
  expect(toJsonSafeInteger(-9_007_199_254_740_992n)).toBe('-9007199254740992');
});

test('rows carry 64-bit integers as exact decimal strings', async () => {
  const fastify = await buildViewer(openHashes());
  const response = await fastify.inject({
    method: 'GET',
    url: '/db/tables/hashes',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json<TableRowsResponse>().rows).toStrictEqual([
    { id: 1, hash: 42 },
    { id: 2, hash: '9007199254740993' },
    { id: 3, hash: '-5764607523034234880' },
  ]);
});

test('a search finds a 64-bit integer by its digits', async () => {
  const fastify = await buildViewer(openHashes());
  const response = await fastify.inject({
    method: 'GET',
    url: '/db/tables/hashes?search=9007199254740993',
  });
  const body = response.json<TableRowsResponse>();

  expect(response.statusCode).toBe(200);
  expect(body.rows).toStrictEqual([{ id: 2, hash: '9007199254740993' }]);
  expect(body.total).toBe(1);
});

test('a sequence past 2^53 leaves the other tables their sequence estimate', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
    INSERT INTO events (name) VALUES ('start'), ('stop');
    CREATE TABLE hashed (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
    INSERT INTO hashed VALUES (9007199254740993, 'far');
  `);
  const fastify = await buildViewer(db);
  const response = await fastify.inject({ method: 'GET', url: '/db/tables' });
  const counts = response
    .json<TablesResponse>()
    .tables.map(({ name, rowCount, approximate }) => ({
      name,
      rowCount,
      approximate,
    }));

  expect(response.statusCode).toBe(200);
  expect(counts).toStrictEqual([
    { name: 'events', rowCount: 2, approximate: true },
    { name: 'hashed', rowCount: 0, approximate: true },
  ]);
});

test('a connection opened with readBigInts still answers JSON numbers', async () => {
  const db = new DatabaseSync(':memory:', { readBigInts: true });
  db.exec(`
    CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
    INSERT INTO events (name) VALUES ('start'), ('stop');
  `);
  const fastify = await buildViewer(db);
  const tables = await fastify.inject({ method: 'GET', url: '/db/tables' });
  const search = await fastify.inject({
    method: 'GET',
    url: '/db/tables/events?search=stop',
  });

  expect(tables.statusCode).toBe(200);
  expect(tables.json<TablesResponse>().tables).toStrictEqual([
    {
      name: 'events',
      type: 'table',
      rowCount: 2,
      approximate: true,
      columns: [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
      ],
    },
  ]);
  expect(search.statusCode).toBe(200);
  expect(search.json<TableRowsResponse>()).toStrictEqual({
    tableName: 'events',
    columns: ['id', 'name'],
    rows: [{ id: 2, name: 'stop' }],
    total: 1,
    approximate: false,
    scanned: 2,
    complete: true,
    limit: 50,
    offset: 0,
    maxOffset: 100_000,
  });
});
