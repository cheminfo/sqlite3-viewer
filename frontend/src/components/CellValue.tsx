import { Button, Intent, Tag } from '@blueprintjs/core';

/** Maximum character length before truncating a cell value. */
const MAX_CELL_LENGTH = 200;

interface CellValueProps {
  cellKey: string;
  value: unknown;
  isExpanded: boolean;
  onToggle: (cellKey: string | null) => void;
}

/**
 * Render a single table cell, with smart formatting for JSON objects,
 * arrays, numbers, booleans, and nulls. JSON and long-text values can be
 * expanded inline.
 * @param props - Component props.
 */
export function CellValue({
  cellKey,
  value,
  isExpanded,
  onToggle,
}: CellValueProps) {
  if (value === null || value === undefined) {
    return (
      <td style={{ color: '#8a9ba8', fontStyle: 'italic', fontSize: 12 }}>
        NULL
      </td>
    );
  }

  if (typeof value === 'object') {
    return (
      <ObjectCell
        cellKey={cellKey}
        value={value}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
    );
  }

  if (typeof value === 'boolean') {
    return (
      <td>
        <Tag minimal intent={value ? Intent.SUCCESS : Intent.NONE}>
          {String(value)}
        </Tag>
      </td>
    );
  }

  if (typeof value === 'number') {
    return (
      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
        {value.toLocaleString()}
      </td>
    );
  }

  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  return (
    <StringCell
      cellKey={cellKey}
      value={stringValue}
      isExpanded={isExpanded}
      onToggle={onToggle}
    />
  );
}

interface ObjectCellProps {
  cellKey: string;
  value: object;
  isExpanded: boolean;
  onToggle: (cellKey: string | null) => void;
}

/**
 * Render a JSON object/array cell with an expand/collapse toggle.
 * @param props - Component props.
 */
function ObjectCell({ cellKey, value, isExpanded, onToggle }: ObjectCellProps) {
  const jsonString = JSON.stringify(value, null, isExpanded ? 2 : undefined);
  const isLong = jsonString.length > MAX_CELL_LENGTH;

  if (isExpanded) {
    return (
      <td style={{ maxWidth: 400, position: 'relative' }}>
        <ExpandedView text={jsonString} onClose={() => onToggle(null)} />
      </td>
    );
  }
  return (
    <td style={{ maxWidth: 400 }}>
      <CollapsedRow
        text={
          isLong ? `${jsonString.slice(0, MAX_CELL_LENGTH)}...` : jsonString
        }
        monospace
        onExpand={isLong ? () => onToggle(cellKey) : undefined}
      />
    </td>
  );
}

interface StringCellProps {
  cellKey: string;
  value: string;
  isExpanded: boolean;
  onToggle: (cellKey: string | null) => void;
}

/**
 * Render a plain text cell, with expand/collapse for long strings.
 * @param props - Component props.
 */
function StringCell({ cellKey, value, isExpanded, onToggle }: StringCellProps) {
  const isLong = value.length > MAX_CELL_LENGTH;
  if (!isLong) return <td style={{ fontSize: 12 }}>{value}</td>;
  if (isExpanded) {
    return (
      <td style={{ maxWidth: 400 }}>
        <ExpandedView text={value} onClose={() => onToggle(null)} />
      </td>
    );
  }
  return (
    <td style={{ maxWidth: 400 }}>
      <CollapsedRow
        text={`${value.slice(0, MAX_CELL_LENGTH)}...`}
        onExpand={() => onToggle(cellKey)}
      />
    </td>
  );
}

interface CollapsedRowProps {
  text: string;
  monospace?: boolean;
  onExpand?: () => void;
}

/**
 * Render a single-line cell preview with an optional "expand" button.
 * @param props - Component props.
 */
function CollapsedRow({ text, monospace, onExpand }: CollapsedRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{
          fontSize: 12,
          fontFamily: monospace ? 'monospace' : undefined,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 300,
          display: 'inline-block',
        }}
      >
        {text}
      </span>
      {onExpand && (
        <Button
          size="small"
          variant="minimal"
          icon="expand-all"
          onClick={onExpand}
          title="Expand"
        />
      )}
    </div>
  );
}

interface ExpandedViewProps {
  text: string;
  onClose: () => void;
}

/**
 * Render the expanded `<pre>` view of a long cell value with a close button.
 * @param props - Component props.
 */
function ExpandedView({ text, onClose }: ExpandedViewProps) {
  return (
    <div>
      <Button
        size="small"
        variant="minimal"
        icon="cross"
        onClick={onClose}
        style={{ float: 'right' }}
      />
      <pre
        style={{
          margin: 0,
          fontSize: 11,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 400,
          overflowY: 'auto',
          background: '#f5f8fa',
          padding: 8,
          borderRadius: 3,
        }}
      >
        {text}
      </pre>
    </div>
  );
}
