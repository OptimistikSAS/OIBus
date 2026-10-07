import { describe, expect, test } from 'vitest';

import { findItemIndex } from './find-item-index';

describe('findItemIndex', () => {
  const saved = { id: 'id1', name: 'saved' };
  const firstUnsaved = { id: '', name: 'unsaved-1' };
  const secondUnsaved = { id: '', name: 'unsaved-2' };
  const items = [saved, firstUnsaved, secondUnsaved];

  test('should find the item by reference, even when other items share its empty id', () => {
    expect(findItemIndex(items, secondUnsaved)).toBe(2);
  });

  test('should fall back to a non-empty id match for another reference', () => {
    expect(findItemIndex(items, { id: 'id1', name: 'renamed' })).toBe(0);
  });

  test('should fall back to a name match for another reference without id', () => {
    expect(findItemIndex(items, { id: '', name: 'unsaved-2' })).toBe(2);
  });

  test('should return -1 when the item is not in the list', () => {
    expect(findItemIndex(items, { id: '', name: 'unknown' })).toBe(-1);
  });
});
