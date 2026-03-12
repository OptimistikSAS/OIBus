import { testEnumPipe } from './base-enum-pipe.spec';
import { OibusOutputDataTypeEnumPipe } from './oibus-output-data-type-enum.pipe';

describe('OibusOutputDataTypeEnumPipe', () => {
  it('should translate OIBus Output data type', () => {
    testEnumPipe(OibusOutputDataTypeEnumPipe, {
      any: 'Any',
      mqtt: 'MQTT',
      modbus: 'Modbus',
      oianalytics: 'OIAnalytics optimized time values',
      opcua: 'OPCUA',
      'time-values': 'OIBus time values'
    });
  });
});
