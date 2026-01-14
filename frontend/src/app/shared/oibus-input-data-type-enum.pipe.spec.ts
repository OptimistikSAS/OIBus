import { testEnumPipe } from './base-enum-pipe.spec';
import { OibusInputDataTypeEnumPipe } from './oibus-input-data-type-enum.pipe';

describe('OIBusInputDataTypeEnumPipe', () => {
  it('should translate OIBus Input data type', () => {
    testEnumPipe(OibusInputDataTypeEnumPipe, {
      any: 'Files (for all sources)',
      setpoint: 'Setpoints (for all sources)',
      'time-values': 'OIBus Time Values (for all sources)'
    });
  });
});
