import CsvSchema from './csv'
import ModbusSchema from './modbus'
import MqttSchema from './mqtt'
import OpcuaSchema from './opcua'
import RawFileSchema from './rawFile'

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
