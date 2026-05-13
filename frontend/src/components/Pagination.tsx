import { Button, ButtonGroup } from '@blueprintjs/core';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

interface PaginationProps {
  /** Current page offset (0-based). */
  offset: number;
  /** Number of items per page. */
  pageSize: number;
  /** Total number of items. */
  total: number;
  /** Called when the offset changes. */
  onOffsetChange: (offset: number) => void;
  /**
   * Maximum number of navigable pages. When the real page count exceeds
   * this value, navigation is capped here to avoid triggering extremely
   * slow offset scans on large datasets.
   * @default unlimited
   */
  maxNavigablePages?: number;
}

/**
 * Pagination bar with previous/next buttons and page-number jump buttons.
 * Shows up to 5 pages before and 5 pages after the current page.
 * @param props - Component props.
 */
export function Pagination({
  offset,
  pageSize,
  total,
  onOffsetChange,
  maxNavigablePages,
}: PaginationProps) {
  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const navigablePages =
    maxNavigablePages !== undefined
      ? Math.min(totalPages, maxNavigablePages)
      : totalPages;

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 5);
    const end = Math.min(navigablePages, currentPage + 5);
    for (let page = start; page <= end; page++) pages.push(page);
    return pages;
  }, [currentPage, navigablePages]);

  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 0',
      }}
    >
      <Button
        size="small"
        variant="minimal"
        icon="chevron-left"
        disabled={currentPage === 1}
        onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}
      />
      <PaginationButtons
        pageNumbers={pageNumbers}
        currentPage={currentPage}
        totalPages={navigablePages}
        pageSize={pageSize}
        onOffsetChange={onOffsetChange}
      />
      <Button
        size="small"
        variant="minimal"
        icon="chevron-right"
        disabled={currentPage === navigablePages}
        onClick={() => onOffsetChange(offset + pageSize)}
      />
    </div>
  );
}

interface PaginationButtonsProps {
  pageNumbers: number[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onOffsetChange: (offset: number) => void;
}

/**
 * Inner button group rendering page-number buttons with leading/trailing
 * ellipses when the visible window is offset from the first/last page.
 * @param props - Component props.
 */
function PaginationButtons({
  pageNumbers,
  currentPage,
  totalPages,
  pageSize,
  onOffsetChange,
}: PaginationButtonsProps) {
  const firstPage = pageNumbers[0];
  const lastPage = pageNumbers.at(-1);

  const buttons: ReactNode[] = [];

  if (firstPage !== undefined && firstPage > 1) {
    buttons.push(
      <Button
        key="first"
        size="small"
        variant="minimal"
        onClick={() => onOffsetChange(0)}
      >
        1
      </Button>,
    );
    if (firstPage > 2) {
      buttons.push(
        <Button key="start-ellipsis" size="small" variant="minimal" disabled>
          …
        </Button>,
      );
    }
  }

  for (const page of pageNumbers) {
    buttons.push(
      <Button
        key={page}
        size="small"
        variant={page === currentPage ? 'outlined' : 'minimal'}
        intent={page === currentPage ? 'primary' : 'none'}
        onClick={() => onOffsetChange((page - 1) * pageSize)}
      >
        {page}
      </Button>,
    );
  }

  if (lastPage !== undefined && lastPage < totalPages) {
    if (lastPage < totalPages - 1) {
      buttons.push(
        <Button key="end-ellipsis" size="small" variant="minimal" disabled>
          …
        </Button>,
      );
    }
    buttons.push(
      <Button
        key="last"
        size="small"
        variant="minimal"
        onClick={() => onOffsetChange((totalPages - 1) * pageSize)}
      >
        {totalPages}
      </Button>,
    );
  }

  return <ButtonGroup>{buttons}</ButtonGroup>;
}
