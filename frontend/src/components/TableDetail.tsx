import { Callout, HTMLTable, Intent, Spinner, Tag } from '@blueprintjs/core';

import type { TableInfo, TableRowsResponse } from '../types.ts';
import { formatRowCount } from '../utils/formatRowCount.ts';

import { CellValue } from './CellValue.tsx';
import { FilterInput } from './FilterInput.tsx';
import { Pagination } from './Pagination.tsx';

interface TableDetailProps {
  tableMeta: TableInfo;
  rowsData: TableRowsResponse | null;
  rowsLoading: boolean;
  rowsError: string | null;
  pageSize: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  expandedCell: string | null;
  onExpandCell: (cellKey: string | null) => void;
}

/**
 * Right-side detail view: table metadata, search box, paginated rows, and
 * inline cell expansion.
 * @param props - Component props.
 */
export function TableDetail({
  tableMeta,
  rowsData,
  rowsLoading,
  rowsError,
  pageSize,
  offset,
  onOffsetChange,
  search,
  onSearchChange,
  expandedCell,
  onExpandCell,
}: TableDetailProps) {
  const columns = rowsData?.columns ?? [];
  const rows = rowsData?.rows ?? [];
  const total = rowsData?.total ?? 0;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>{tableMeta.name}</h3>
        <Tag intent={Intent.PRIMARY} minimal>
          {tableMeta.type}
        </Tag>
        <Tag minimal>
          {formatRowCount(tableMeta.rowCount, tableMeta.approximate)} row
          {tableMeta.rowCount !== 1 ? 's' : ''}
        </Tag>
        <Tag minimal>
          {tableMeta.columns.length} column
          {tableMeta.columns.length !== 1 ? 's' : ''}
        </Tag>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          marginBottom: 12,
        }}
      >
        {tableMeta.columns.map((column) => (
          <Tag key={column.name} minimal>
            {column.name}
            {column.type ? ` (${column.type})` : ''}
          </Tag>
        ))}
      </div>

      <FilterInput
        value={search}
        onChange={onSearchChange}
        placeholder={`Search in ${tableMeta.name}...`}
        style={{ marginBottom: 12 }}
      />

      {rowsError && (
        <Callout intent={Intent.DANGER} style={{ marginBottom: 12 }}>
          {rowsError}
        </Callout>
      )}

      {rowsLoading && !rowsData ? (
        <Spinner />
      ) : (
        <>
          <Pagination
            offset={offset}
            pageSize={pageSize}
            total={total}
            onOffsetChange={onOffsetChange}
          />

          <div style={{ overflowX: 'auto' }}>
            <HTMLTable bordered compact striped style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap', width: 40 }}>#</th>
                  {columns.map((column) => (
                    <th key={column} style={{ whiteSpace: 'nowrap' }}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  // Generic table viewer: no known primary key column, so the
                  // best stable key per page is the absolute row position.
                  // eslint-disable-next-line react/no-array-index-key
                  <tr key={offset + rowIndex}>
                    <td
                      style={{
                        color: '#8a9ba8',
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {offset + rowIndex + 1}
                    </td>
                    {columns.map((column) => {
                      const cellKey = `${String(rowIndex)}-${column}`;
                      return (
                        <CellValue
                          key={cellKey}
                          cellKey={cellKey}
                          value={row[column]}
                          isExpanded={expandedCell === cellKey}
                          onToggle={onExpandCell}
                        />
                      );
                    })}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      style={{ textAlign: 'center', color: '#8a9ba8' }}
                    >
                      No rows
                    </td>
                  </tr>
                )}
              </tbody>
            </HTMLTable>
          </div>

          <Pagination
            offset={offset}
            pageSize={pageSize}
            total={total}
            onOffsetChange={onOffsetChange}
          />
        </>
      )}
    </div>
  );
}
