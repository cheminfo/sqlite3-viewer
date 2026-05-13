import type { TableRowsResponse, TablesResponse } from './types.ts';

/**
 * Build a thin client for the `sqlite3-viewer-backend` Fastify plugin
 * mounted at `apiBasePath`. Every method calls `fetch` directly — no
 * external dependencies, no shared state.
 *
 * Pass an explicit `fetcher` to wire the client into a host app's auth
 * (e.g. injecting an `Authorization` header or carrying a session cookie).
 * @param apiBasePath - Path the plugin is mounted at (e.g. `/v1/database`).
 *   No trailing slash.
 * @param fetcher - Optional custom fetch — defaults to `globalThis.fetch`.
 * @returns Object with `tables`, `tableRows`, and `schemaSvgUrl` helpers.
 */
export function createApiClient(
  apiBasePath: string,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
) {
  async function request<T>(path: string): Promise<T> {
    const response = await fetcher(`${apiBasePath}${path}`);
    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(`GET ${apiBasePath}${path} failed: ${message}`);
    }
    return response.json() as Promise<T>;
  }

  return {
    tables: () => request<TablesResponse>('/tables'),
    tableRows: (
      tableName: string,
      params?: { limit?: number; offset?: number; search?: string },
    ) => {
      const query = new URLSearchParams();
      if (params?.limit !== undefined) query.set('limit', String(params.limit));
      if (params?.offset !== undefined) {
        query.set('offset', String(params.offset));
      }
      if (params?.search) query.set('search', params.search);
      const queryString = query.toString();
      return request<TableRowsResponse>(
        `/tables/${tableName}${queryString ? `?${queryString}` : ''}`,
      );
    },
    schemaSvgUrl: () => `${apiBasePath}/schema`,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Pull a useful error message out of a non-OK response, falling back to the
 * HTTP status text when the body is missing or unparseable.
 * @param response - The failed `fetch` response.
 * @returns Server-supplied error message, or the status text.
 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: string;
      message?: string;
    };
    return body.error ?? body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
