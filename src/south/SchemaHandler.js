import CsvSchema from './CSV/schema'
import ModbusSchema from './Modbus/schema'
import MqttSchema from './MQTT/schema'
import OpcuaSchema from './OPCUA/schema'
import RawFileSchema from './RawFile/schema'

function getScheme(protocol) {
  switch (protocol) {
    case 'CSV':
      return CsvSchema
    case 'Modbus':
      return ModbusSchema
    case 'MQTT':
      return MqttSchema
    case 'OPCUA':
      return OpcuaSchema
    case 'RawFile':
      return RawFileSchema
    default:
      return CsvSchema
  }
}

// eslint-disable-next-line import/prefer-default-export
export { getScheme }
