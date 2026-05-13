import { DatabaseSync } from 'node:sqlite';

import Fastify from 'fastify';
import { expect, test } from 'vitest';

import { sqliteViewerPlugin } from '../index.ts';
import type { TableRowsResponse, TablesResponse } from '../types.ts';

/**
 * Build a Fastify instance with the plugin mounted at `/db`, backed by an
 * in-memory database seeded with two tiny tables.
 * @returns The Fastify instance and the underlying database connection.
 */
async function buildApp() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE molecules (id INTEGER PRIMARY KEY, smiles TEXT, mw REAL);
    INSERT INTO molecules VALUES (1, 'CCO', 46.07), (2, 'CC', 30.07);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, payload TEXT);
    INSERT INTO notes VALUES (1, '{"k":1}'), (2, 'plain');
  `);

  const fastify = Fastify();
  await fastify.register(sqliteViewerPlugin, {
    db,
    prefix: '/db',
    exactCountOverrides: {
      molecules: () => 2,
    },
  });
  await fastify.ready();
  return { fastify, db };
}

test('GET /db/tables lists tables with column info and exact override', async () => {
  const { fastify } = await buildApp();
  const response = await fastify.inject({ method: 'GET', url: '/db/tables' });

  expect(response.statusCode).toBe(200);

  const body = response.json<TablesResponse>();

  expect(body.tables.map((table) => table.name)).toStrictEqual([
    'molecules',
    'notes',
  ]);

  const molecules = body.tables.find((table) => table.name === 'molecules');

  expect(molecules).toStrictEqual({
    name: 'molecules',
    type: 'table',
    rowCount: 2,
    approximate: false,
    columns: [
      { name: 'id', type: 'INTEGER' },
      { name: 'smiles', type: 'TEXT' },
      { name: 'mw', type: 'REAL' },
    ],
  });
});

test('GET /db/tables/:name paginates rows and parses JSON-looking strings', async () => {
  const { fastify } = await buildApp();
  const response = await fastify.inject({
    method: 'GET',
    url: '/db/tables/notes?limit=10&offset=0',
  });

  expect(response.statusCode).toBe(200);

  const body = response.json<TableRowsResponse>();

  expect(body).toStrictEqual({
    tableName: 'notes',
    columns: ['id', 'payload'],
    rows: [
      { id: 1, payload: { k: 1 } },
      { id: 2, payload: 'plain' },
    ],
    // `notes` has no AUTOINCREMENT, no exact-count override, and `ANALYZE`
    // was never run — so `resolveFastCount` falls through all tiers and
    // returns 0 / approximate. The rows themselves are still returned in
    // full because `LIMIT/OFFSET` operates on the actual table.
    total: 0,
    approximate: true,
    limit: 10,
    offset: 0,
  });
});

test('search filter narrows results and returns an exact count', async () => {
  const { fastify } = await buildApp();
  const response = await fastify.inject({
    method: 'GET',
    url: '/db/tables/molecules?search=CCO',
  });

  expect(response.statusCode).toBe(200);

  const body = response.json<TableRowsResponse>();

  expect(body.rows).toStrictEqual([{ id: 1, smiles: 'CCO', mw: 46.07 }]);
  expect(body.total).toBe(1);
  expect(body.approximate).toBe(false);
});

test('invalid table name is rejected with 400', async () => {
  const { fastify } = await buildApp();
  const response = await fastify.inject({
    method: 'GET',
    url: '/db/tables/bad-name;DROP',
  });

  expect(response.statusCode).toBe(400);
});

test('missing table returns 404', async () => {
  const { fastify } = await buildApp();
  const response = await fastify.inject({
    method: 'GET',
    url: '/db/tables/does_not_exist',
  });

  expect(response.statusCode).toBe(404);
});

test('GET /db/schema returns 404 when no SVG path is configured', async () => {
  const { fastify } = await buildApp();
  const response = await fastify.inject({ method: 'GET', url: '/db/schema' });

  expect(response.statusCode).toBe(404);
});

test('mounts at /v1/database by default when no prefix is supplied', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE molecules (id INTEGER PRIMARY KEY, smiles TEXT);
    INSERT INTO molecules VALUES (1, 'CCO');
  `);

  const fastify = Fastify();
  await fastify.register(sqliteViewerPlugin, { db });
  await fastify.ready();

  const defaultPrefix = await fastify.inject({
    method: 'GET',
    url: '/v1/database/tables',
  });

  expect(defaultPrefix.statusCode).toBe(200);
  expect(defaultPrefix.json<TablesResponse>().tables[0]?.name).toBe(
    'molecules',
  );

  const rootMiss = await fastify.inject({ method: 'GET', url: '/tables' });

  expect(rootMiss.statusCode).toBe(404);
});
