import { testEnumPipe } from './base-enum-pipe.spec';
import { DatetimeTypesEnumPipe } from './datetime-types-enum.pipe';

describe('DatetimeTypesEnumPipe', () => {
  it('should translate datetime type', () => {
    testEnumPipe(ts => new DatetimeTypesEnumPipe(ts), {
      'iso-8601-string': 'ISO 8601',
      'specific-string': 'Custom format',
      'unix-epoch': 'UNIX Epoch (s)',
      'unix-epoch-ms': 'UNIX Epoch (ms)',
      'date-object': 'Date object'
    });
  });
});
