import { testEnumPipe } from './base-enum-pipe.spec';
import { OibusInputDataTypeEnumPipe } from './oibus-input-data-type-enum.pipe';

describe('OIBusInputDataTypeEnumPipe', () => {
  it('should translate OIBus Input data type', () => {
    testEnumPipe(OibusInputDataTypeEnumPipe, {
      any: 'Any',
      'time-values': 'OIBus time values',
      setpoint: 'Setpoints'
    });
  });
});
