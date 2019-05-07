import CSVUISchema from './CSV/uiSchema.jsx'
import ModbusUISchema from './Modbus/uiSchema.jsx'
import MQTTUISchema from './MQTT/uiSchema.jsx'
import OPCUAUISchema from './OPCUA/uiSchema.jsx'
import RawFileUISchema from './RawFile/uiSchema.jsx'

/**
 * Returns the uiSchema for the protocol
 * @param {String} protocol protocol name
 * @returns {object} uiSchema json
 */
const uiSchema = (protocol) => {
  switch (protocol) {
    case 'CSV':
      return CSVUISchema
    case 'Modbus':
      return ModbusUISchema
    case 'MQTT':
      return MQTTUISchema
    case 'OPCUA':
      return OPCUAUISchema
    case 'RawFile':
      return RawFileUISchema
    default:
      console.error('protocol has no uiSchema')
      return {}
  }
}

export default uiSchema
