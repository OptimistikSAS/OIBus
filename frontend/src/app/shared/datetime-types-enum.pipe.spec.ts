import { testEnumPipe } from './base-enum-pipe.spec';
import { DatetimeTypesEnumPipe } from './datetime-types-enum.pipe';

describe('DatetimeTypesEnumPipe', () => {
  it('should translate datetime type', () => {
    testEnumPipe(() => new DatetimeTypesEnumPipe(), {
      'iso-string': 'ISO 8601',
      string: 'String',
      'unix-epoch': 'UNIX Epoch (s)',
      'unix-epoch-ms': 'UNIX Epoch (ms)'
    });
  });
});
