import { describe, expect, test } from 'vitest';

import { ArrayPage } from './array-page';

describe('ArrayPage', () => {
  test.each([
    { name: 'a multiple of size', array: ['a', 'b', 'c', 'd', 'e', 'f'], secondPage: ['d', 'e', 'f'] },
    { name: 'not a multiple of size', array: ['a', 'b', 'c', 'd', 'e'], secondPage: ['d', 'e'] }
  ])('should paginate an array whose length is $name', ({ array, secondPage }) => {
    const page = new ArrayPage<string>(array, 3);
    expect(page).toMatchObject({ size: 3, content: ['a', 'b', 'c'], number: 0, totalElements: array.length, totalPages: 2 });

    const nextPage = page.gotoPage(1);

    expect(nextPage).toMatchObject({ size: 3, content: secondPage, number: 1, totalElements: array.length, totalPages: 2 });
    // pages are immutable
    expect(page).toMatchObject({ content: ['a', 'b', 'c'], number: 0 });
  });

  test('should start at the given page', () => {
    expect(new ArrayPage(['a', 'b', 'c'], 2, 1)).toMatchObject({ content: ['c'], number: 1 });
  });

  test('should return the same page when going to the current page', () => {
    const page = new ArrayPage(['a', 'b', 'c'], 2);

    expect(page.gotoPage(0)).toBe(page);
  });

  test('should handle an empty array', () => {
    expect(new ArrayPage([], 2)).toMatchObject({ content: [], number: 0, totalElements: 0, totalPages: 0 });
  });
});
