import { Callout, Intent, Spinner } from '@blueprintjs/core';
import { useCallback, useMemo, useState } from 'react';

import type { ApiClient } from './apiClient.ts';
import { createApiClient } from './apiClient.ts';
import { SchemaDiagram } from './components/SchemaDiagram.tsx';
import { TableDetail } from './components/TableDetail.tsx';
import { TableList } from './components/TableList.tsx';
import { useApi } from './hooks/useApi.ts';

/** Default rows per page when the consumer does not override it. */
const DEFAULT_PAGE_SIZE = 50;

/** Props for `DatabaseBrowserPanel`. */
export interface DatabaseBrowserPanelProps {
  /**
   * Path the `sqlite3-viewer-backend` plugin is mounted at, relative to
   * the page origin (e.g. `/v1/database`). No trailing slash.
   */
  apiBasePath: string;
  /**
   * Optional custom `fetch` — useful to inject auth headers or carry a
   * session cookie. Defaults to the global `fetch`.
   * @default globalThis.fetch
   */
  fetcher?: typeof fetch;
  /**
   * Rows per page in the row browser.
   * @default 50
   */
  pageSize?: number;
}

/**
 * Database browser panel for inspecting SQLite tables and views.
 * Shows an optional clickable schema diagram on top, a table list on the
 * left, and paginated row data on the right.
 * @param props - Component props.
 */
export function DatabaseBrowserPanel({
  apiBasePath,
  fetcher,
  pageSize = DEFAULT_PAGE_SIZE,
}: DatabaseBrowserPanelProps) {
  const api = useMemo(
    () => createApiClient(apiBasePath, fetcher),
    [apiBasePath, fetcher],
  );

  return <PanelInner api={api} pageSize={pageSize} />;
}

interface PanelInnerProps {
  api: ApiClient;
  pageSize: number;
}

/**
 * Inner component that owns the panel's selection / pagination state. Split
 * out so the outer component stays a thin props-to-client adapter.
 * @param props - Component props.
 */
function PanelInner({ api, pageSize }: PanelInnerProps) {
  const {
    data: tablesData,
    loading: tablesLoading,
    error: tablesError,
  } = useApi(() => api.tables(), [api]);

  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  const tables = useMemo(() => tablesData?.tables ?? [], [tablesData]);

  const [userSelectedTable, setUserSelectedTable] = useState<string | null>(
    null,
  );
  const selectedTable = useMemo(() => {
    if (userSelectedTable !== null) return userSelectedTable;
    return tables.length > 0 ? (tables[0]?.name ?? null) : null;
  }, [userSelectedTable, tables]);

  const {
    data: rowsData,
    loading: rowsLoading,
    error: rowsError,
  } = useApi(
    () =>
      selectedTable
        ? api.tableRows(selectedTable, {
            limit: pageSize,
            offset,
            search: search || undefined,
          })
        : Promise.resolve(null),
    [selectedTable, offset, search, pageSize, api],
  );

  const handleTableSelect = useCallback((tableName: string) => {
    setUserSelectedTable(tableName);
    setOffset(0);
    setSearch('');
    setExpandedCell(null);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setOffset(0);
    setExpandedCell(null);
  }, []);

  const handleOffsetChange = useCallback((newOffset: number) => {
    setOffset(newOffset);
    setExpandedCell(null);
  }, []);

  const selectedTableMeta = useMemo(
    () => tables.find((table) => table.name === selectedTable),
    [tables, selectedTable],
  );

  if (tablesLoading && !tablesData) return <Spinner />;
  if (tablesError) {
    return <Callout intent={Intent.DANGER}>{tablesError}</Callout>;
  }

  return (
    <div>
      <SchemaDiagram
        schemaUrl={api.schemaSvgUrl()}
        onTableClick={handleTableSelect}
        selectedTable={selectedTable}
      />
      <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
        <TableList
          tables={tables}
          selectedTable={selectedTable}
          onSelect={handleTableSelect}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedTable && selectedTableMeta && (
            <TableDetail
              tableMeta={selectedTableMeta}
              rowsData={rowsData}
              rowsLoading={rowsLoading}
              rowsError={rowsError}
              pageSize={pageSize}
              offset={offset}
              onOffsetChange={handleOffsetChange}
              search={search}
              onSearchChange={handleSearchChange}
              expandedCell={expandedCell}
              onExpandCell={setExpandedCell}
            />
          )}
        </div>
      </div>
    </div>
  );
}
