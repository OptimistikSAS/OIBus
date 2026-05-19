import { describe, expect, test, beforeEach } from 'vitest';
import { IsoTimeAdapterService } from './iso-time-adapter.service';
import { NgbTimeStruct } from '@ng-bootstrap/ng-bootstrap';

describe('IsoTimeAdapterService', () => {
  let adapter: IsoTimeAdapterService;

  beforeEach(() => {
    adapter = new IsoTimeAdapterService();
  });

  describe('fromModel', () => {
    test('should return null if model is falsy', () => {
      expect(adapter.fromModel(null)).toBeNull();
      expect(adapter.fromModel('')).toBeNull();
    });

    test('should parse model', () => {
      const expected: NgbTimeStruct = { hour: 21, minute: 12, second: 2 };
      expect(adapter.fromModel('21:12:02.000')).toEqual(expected);
      expect(adapter.fromModel('21:12:02')).toEqual(expected);
    });
  });

  describe('toModel', () => {
    test('should return null if struct is falsy', () => {
      expect(adapter.toModel(null)).toBeNull();
    });

    test('should create model', () => {
      const struct: NgbTimeStruct = { hour: 21, minute: 12, second: 2 };
      expect(adapter.toModel(struct)).toEqual('21:12:02');
    });
  });
});
