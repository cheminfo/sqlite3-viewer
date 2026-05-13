import { expect, test, vi } from 'vitest';

import { createApiClient } from '../apiClient.ts';
import type { TableRowsResponse, TablesResponse } from '../types.ts';

/**
 * Build a fake `fetch` that records every URL it is called with and replies
 * with the provided JSON payload.
 * @param payload - Body returned by the fake fetch.
 * @returns The fake fetch and the array capturing every call URL.
 */
function makeFetcher(payload: unknown) {
  const calls: string[] = [];
  const fetcher = vi.fn(async (url: string) => {
    calls.push(url);
    return Response.json(payload, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  return { fetcher: fetcher as unknown as typeof fetch, calls };
}

test('tables() requests /<base>/tables', async () => {
  const payload: TablesResponse = { tables: [] };
  const { fetcher, calls } = makeFetcher(payload);
  const api = createApiClient('/v1/database', fetcher);
  const result = await api.tables();

  expect(calls).toStrictEqual(['/v1/database/tables']);
  expect(result).toStrictEqual(payload);
});

test('tableRows() encodes pagination and search into the query string', async () => {
  const payload: TableRowsResponse = {
    tableName: 'molecules',
    columns: ['id'],
    rows: [{ id: 1 }],
    total: 1,
    approximate: false,
    limit: 10,
    offset: 20,
  };
  const { fetcher, calls } = makeFetcher(payload);
  const api = createApiClient('/v1/database', fetcher);
  await api.tableRows('molecules', { limit: 10, offset: 20, search: 'CCO' });

  expect(calls).toStrictEqual([
    '/v1/database/tables/molecules?limit=10&offset=20&search=CCO',
  ]);
});

test('schemaSvgUrl() returns the absolute schema endpoint', () => {
  const api = createApiClient('/v1/database');

  expect(api.schemaSvgUrl()).toBe('/v1/database/schema');
});

test('failed responses throw with the server-supplied error message', async () => {
  const fetcher = vi.fn(async () =>
    Response.json(
      { error: 'Table not found' },
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/json' },
      },
    ),
  ) as unknown as typeof fetch;
  const api = createApiClient('/v1/database', fetcher);

  await expect(api.tableRows('nope')).rejects.toThrow('Table not found');
});
