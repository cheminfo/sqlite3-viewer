import { expect, test } from 'vitest';

import { reachablePageCount } from '../reachablePageCount.ts';

test('the last reachable page starts at or below maxOffset', () => {
  // Page 2001 starts at offset 100,000.
  expect(reachablePageCount(100_000, 50)).toBe(2001);
  // Page 3334 starts at 99,990; page 3335 would start at 100,020.
  expect(reachablePageCount(100_000, 30)).toBe(3334);
  expect(reachablePageCount(50, 50)).toBe(2);
  expect(reachablePageCount(49, 50)).toBe(1);
  expect(reachablePageCount(0, 50)).toBe(1);
});
