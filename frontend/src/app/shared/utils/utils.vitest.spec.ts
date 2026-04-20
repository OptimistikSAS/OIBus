import { describe, expect, test } from 'vitest';
import { getAssociatedInputType } from './utils';

describe('utils', () => {
  describe('getAssociatedInputType', () => {
    test('should get associated input type from south type', () => {
      expect(getAssociatedInputType('ads')).toBe('time-values');
      expect(getAssociatedInputType('sqlite')).toBe('any');
    });
  });
});
