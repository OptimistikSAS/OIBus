import { testEnumPipe } from './base-enum-pipe.spec';
import { OIBusDataTypeEnumPipe } from './oibus-data-type-enum.pipe';

describe('OIBusDataTypeEnumPipe', () => {
  it('should translate OIBus data type', () => {
    testEnumPipe(OIBusDataTypeEnumPipe, {
      any: 'Any',
      'time-values': 'OIBus time values'
    });
  });
});
