import { Button } from '@blueprintjs/core';
import { useEffect, useRef, useState } from 'react';

interface SchemaDiagramProps {
  /** URL of the schema SVG endpoint. */
  schemaUrl: string;
  onTableClick: (tableName: string) => void;
  selectedTable: string | null;
}

/**
 * Inline SVG schema diagram with clickable table groups.
 *
 * Fetches the SVG, renders it as `innerHTML`, and attaches click handlers
 * via event delegation on `[data-table]` elements. Renders nothing when
 * the SVG endpoint returns a non-OK response (e.g. 404 from the backend
 * plugin when no `schemaSvgPath` is configured).
 * @param props - Component props.
 */
export function SchemaDiagram({
  schemaUrl,
  onTableClick,
  selectedTable,
}: SchemaDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(schemaUrl)
      .then(async (response) => {
        if (!response.ok) return null;
        return response.text();
      })
      .then((text) => {
        if (!cancelled && text !== null) setSvgContent(text);
      })
      .catch(() => {
        // Ignore fetch errors.
      });
    return () => {
      cancelled = true;
    };
  }, [schemaUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !svgContent || !open) return;

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const tableGroup = target.closest<HTMLElement>('[data-table]');
      if (tableGroup) {
        const tableName = tableGroup.dataset.table;
        if (tableName) onTableClick(tableName);
      }
    }

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [svgContent, onTableClick, open]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const allGroups = container.querySelectorAll<HTMLElement>('[data-table]');
    for (const group of allGroups) {
      const borderRect = group.querySelector(':scope > rect[stroke]');
      if (!borderRect) continue;
      if (group.dataset.table === selectedTable) {
        borderRect.setAttribute('stroke', '#2d72d2');
        borderRect.setAttribute('stroke-width', '2.5');
      } else {
        borderRect.setAttribute('stroke', '#cbd5e1');
        borderRect.setAttribute('stroke-width', '1');
      }
    }
  }, [selectedTable, svgContent, open]);

  if (!svgContent) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <Button
        icon={open ? 'chevron-up' : 'chevron-down'}
        variant="minimal"
        onClick={() => setOpen((previous) => !previous)}
      >
        {open ? 'Hide' : 'Show'} Schema Diagram
      </Button>
      {open && (
        <div
          ref={containerRef}
          style={{
            border: '1px solid #e1e8ed',
            borderRadius: 4,
            padding: 8,
            overflow: 'auto',
            maxHeight: 600,
            background: '#f1f5f9',
          }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      )}
    </div>
  );
}
