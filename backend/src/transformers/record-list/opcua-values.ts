import { TransformerRecordListToOpcuaSettings } from '../../../shared/model/connector/transformer-settings.model';

import { OIBusOPCUAValue } from '../connector-types.model';
import { readPointId, readValue, Row } from './point-record';

/** Where the OPCUA values are read, and the node of each point */
export type OPCUAMappingSettings = Pick<TransformerRecordListToOpcuaSettings, 'pointIdColumn' | 'valueColumn' | 'mapping'>;

/** The value of each row whose point is mapped to a node */
export function toOPCUAValues(rows: Iterable<Row>, settings: OPCUAMappingSettings): Array<OIBusOPCUAValue> {
  const mappingByPointId = new Map(settings.mapping.map(m => [m.pointId, m]));
  const content: Array<OIBusOPCUAValue> = [];
  for (const row of rows) {
    const mapped = mappingByPointId.get(readPointId(row, settings.pointIdColumn) ?? '');
    const value = readValue(row, settings.valueColumn);
    if (!mapped || value === null) continue;
    content.push({ nodeId: mapped.nodeId, value });
  }
  return content;
}
