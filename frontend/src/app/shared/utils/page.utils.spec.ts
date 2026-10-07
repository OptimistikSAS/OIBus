import { describe, expect, test } from 'vitest';

import { emptyPage, toPage } from './page.utils';

describe('page utils', () => {
  test('should build an empty page', () => {
    expect(emptyPage()).toEqual({ content: [], totalElements: 0, number: 0, size: 20, totalPages: 0 });
    expect(emptyPage(50).size).toBe(50);
  });

  test('should build a single page from its content by default', () => {
    expect(toPage(['a', 'b'])).toEqual({ content: ['a', 'b'], totalElements: 2, number: 0, size: 20, totalPages: 1 });
  });

  test('should grow the default size to fit all the elements', () => {
    expect(toPage([], 45)).toEqual({ content: [], totalElements: 45, number: 0, size: 45, totalPages: 1 });
  });

  test('should compute the total pages from the given size', () => {
    expect(toPage(['c'], 41, 2, 20)).toEqual({ content: ['c'], totalElements: 41, number: 2, size: 20, totalPages: 3 });
  });
});
