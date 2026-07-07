/**
 * Tests for backend/shared/model/types.ts.
 * That file lives outside `src/` (the `src/**\/*.spec.ts` test glob does not reach it),
 * so its runtime exports are exercised from a co-located spec here instead.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPageFromArray,
  DEFAULT_TZ,
  LANGUAGES,
  DATE_TIME_TYPES,
  AGGREGATES,
  RESAMPLING,
  ALL_CSV_CHARACTERS,
  SERIALIZATION_TYPES
} from '../../shared/model/types';

describe('createPageFromArray', () => {
  it('returns the first page with correct metadata when there are multiple pages', () => {
    const elements = [1, 2, 3, 4, 5, 6, 7];
    const page = createPageFromArray(elements, 3, 0);
    assert.deepEqual(page.content, [1, 2, 3]);
    assert.equal(page.number, 0);
    assert.equal(page.size, 3);
    assert.equal(page.totalElements, 7);
    assert.equal(page.totalPages, 3);
  });

  it('returns a middle page', () => {
    const elements = [1, 2, 3, 4, 5, 6, 7];
    const page = createPageFromArray(elements, 3, 1);
    assert.deepEqual(page.content, [4, 5, 6]);
    assert.equal(page.number, 1);
  });

  it('returns the last, partial page', () => {
    const elements = [1, 2, 3, 4, 5, 6, 7];
    const page = createPageFromArray(elements, 3, 2);
    assert.deepEqual(page.content, [7]);
    assert.equal(page.number, 2);
    assert.equal(page.totalPages, 3);
  });

  it('returns an empty content array when the page number is out of range', () => {
    const elements = [1, 2, 3];
    const page = createPageFromArray(elements, 3, 5);
    assert.deepEqual(page.content, []);
    assert.equal(page.totalElements, 3);
    assert.equal(page.totalPages, 1);
  });

  it('handles an empty input array', () => {
    const page = createPageFromArray<number>([], 10, 0);
    assert.deepEqual(page.content, []);
    assert.equal(page.totalElements, 0);
    assert.equal(page.totalPages, 0);
    assert.equal(page.size, 10);
    assert.equal(page.number, 0);
  });

  it('computes totalPages as an exact division when elements evenly fill pages', () => {
    const page = createPageFromArray([1, 2, 3, 4], 2, 0);
    assert.equal(page.totalPages, 2);
  });
});

describe('shared model type constants', () => {
  it('DEFAULT_TZ is Europe/Paris', () => {
    assert.equal(DEFAULT_TZ, 'Europe/Paris');
  });

  it('LANGUAGES contains fr and en', () => {
    assert.deepEqual(LANGUAGES, ['fr', 'en']);
  });

  it('DATE_TIME_TYPES contains the expected values', () => {
    assert.ok(DATE_TIME_TYPES.includes('iso-string'));
    assert.ok(DATE_TIME_TYPES.includes('unix-epoch-ms'));
    assert.equal(DATE_TIME_TYPES.length, 11);
  });

  it('AGGREGATES contains the expected values', () => {
    assert.ok(AGGREGATES.includes('raw'));
    assert.ok(AGGREGATES.includes('annotations'));
    assert.equal(AGGREGATES.length, 25);
  });

  it('RESAMPLING contains the expected values', () => {
    assert.deepEqual(RESAMPLING, ['none', '1s', '10s', '30s', '1min', '1h', '1d']);
  });

  it('ALL_CSV_CHARACTERS contains the expected values', () => {
    assert.ok(ALL_CSV_CHARACTERS.includes('COMMA'));
    assert.equal(ALL_CSV_CHARACTERS.length, 8);
  });

  it('SERIALIZATION_TYPES contains csv and file', () => {
    assert.deepEqual(SERIALIZATION_TYPES, ['csv', 'file']);
  });
});
