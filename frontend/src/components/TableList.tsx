import { Menu, MenuDivider, MenuItem, Tag } from '@blueprintjs/core';
import { useMemo } from 'react';

import type { TableInfo } from '../types.ts';
import { formatRowCount } from '../utils/formatRowCount.ts';

interface TableListProps {
  tables: TableInfo[];
  selectedTable: string | null;
  onSelect: (name: string) => void;
}

/**
 * Sidebar listing all tables with row counts.
 * @param props - Component props.
 */
export function TableList({ tables, selectedTable, onSelect }: TableListProps) {
  const tableItems = useMemo(
    () => tables.filter((table) => table.type === 'table'),
    [tables],
  );

  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: '1px solid #e1e8ed',
        paddingRight: 12,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 200px)',
      }}
    >
      <Menu>
        <MenuDivider title={`Tables (${tableItems.length})`} />
        {tableItems.map((table) => (
          <MenuItem
            key={table.name}
            text={table.name}
            active={table.name === selectedTable}
            onClick={() => onSelect(table.name)}
            labelElement={
              <Tag minimal round>
                {formatRowCount(table.rowCount, table.approximate)}
              </Tag>
            }
          />
        ))}
      </Menu>
    </div>
  );
}
