import { AnchorButton, Button, ButtonGroup } from '@blueprintjs/core';
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
   * slow offset scans on large datasets, and a trailing ellipsis marks the
   * pages past the cap.
   * @default unlimited
   */
  maxNavigablePages?: number;
}

/**
 * Pagination bar with previous/next buttons and page-number jump buttons.
 * Shows up to 5 pages before and 5 pages after the current page, and never
 * offers a page past `maxNavigablePages`.
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
  const lastPage =
    maxNavigablePages !== undefined
      ? Math.max(1, Math.min(totalPages, maxNavigablePages))
      : totalPages;

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 5);
    const end = Math.min(lastPage, currentPage + 5);
    for (let page = start; page <= end; page++) pages.push(page);
    return pages;
  }, [currentPage, lastPage]);

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
        lastPage={lastPage}
        hasUnreachablePages={lastPage < totalPages}
        pageSize={pageSize}
        onOffsetChange={onOffsetChange}
      />
      <Button
        size="small"
        variant="minimal"
        icon="chevron-right"
        disabled={currentPage >= lastPage}
        onClick={() => onOffsetChange(offset + pageSize)}
      />
    </div>
  );
}

interface PaginationButtonsProps {
  pageNumbers: number[];
  currentPage: number;
  /** Last page the pager can open. */
  lastPage: number;
  /** True when pages past `lastPage` exist but cannot be opened. */
  hasUnreachablePages: boolean;
  pageSize: number;
  onOffsetChange: (offset: number) => void;
}

/**
 * Inner button group rendering page-number buttons with leading/trailing
 * ellipses when the visible window is offset from the first/last page, and
 * a final ellipsis when pages exist past the last one that can be opened.
 * @param props - Component props.
 */
function PaginationButtons({
  pageNumbers,
  currentPage,
  lastPage,
  hasUnreachablePages,
  pageSize,
  onOffsetChange,
}: PaginationButtonsProps) {
  const firstShown = pageNumbers[0];
  const lastShown = pageNumbers.at(-1);

  const buttons: ReactNode[] = [];

  if (firstShown !== undefined && firstShown > 1) {
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
    if (firstShown > 2) {
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

  if (lastShown !== undefined && lastShown < lastPage) {
    if (lastShown < lastPage - 1) {
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
        onClick={() => onOffsetChange((lastPage - 1) * pageSize)}
      >
        {lastPage}
      </Button>,
    );
  }

  if (hasUnreachablePages) {
    // An AnchorButton keeps its title on hover while disabled; a Button does not.
    buttons.push(
      <AnchorButton
        key="unreachable"
        size="small"
        variant="minimal"
        disabled
        title={`Only the first ${lastPage.toLocaleString()} pages can be opened`}
      >
        …
      </AnchorButton>,
    );
  }

  return <ButtonGroup>{buttons}</ButtonGroup>;
}
