import { testEnumPipe } from './base-enum-pipe.spec';
import { DatetimeTypesEnumPipe } from './datetime-types-enum.pipe';

describe('DatetimeTypesEnumPipe', () => {
  it('should translate datetime type', () => {
    testEnumPipe(ts => new DatetimeTypesEnumPipe(ts), {
      string: 'String',
      number: 'Number',
      datetime: 'Date object'
    });
  });
});
