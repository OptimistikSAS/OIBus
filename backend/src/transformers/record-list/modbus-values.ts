import { TransformerRecordListToModbusSettings } from '../../../shared/model/connector/transformer-settings.model';

import type { ILogger } from '../../model/logger.model';
import { OIBusModbusValue } from '../connector-types.model';
import { toModbusValue } from '../modbus-value';
import { readPointId, readValue, Row } from './point-record';

/** Where the Modbus values are read, and the coil or register of each point */
export type ModbusMappingSettings = Pick<TransformerRecordListToModbusSettings, 'pointIdColumn' | 'valueColumn' | 'mapping'>;

/** The value of each row whose point is mapped to a coil or register, skipping (with a warning) the values a Modbus cannot hold */
export function toModbusValues(rows: Iterable<Row>, settings: ModbusMappingSettings, logger: ILogger): Array<OIBusModbusValue> {
  const mappingByPointId = new Map(settings.mapping.map(m => [m.pointId, m]));
  const content: Array<OIBusModbusValue> = [];
  for (const row of rows) {
    const pointId = readPointId(row, settings.pointIdColumn);
    const mapped = mappingByPointId.get(pointId ?? '');
    if (!mapped) continue;
    const rawValue = readValue(row, settings.valueColumn);
    const value = toModbusValue(rawValue, mapped.modbusType);
    if (value === null) {
      logger.warn(`Value "${rawValue}" of point "${pointId}" cannot be written into a Modbus ${mapped.modbusType}`);
      continue;
    }
    content.push({ address: mapped.address, value, modbusType: mapped.modbusType });
  }
  return content;
}
