import CSVUISchema from './CSV/uiSchema.jsx'
import ModbusUISchema from './Modbus/uiSchema.jsx'
import MQTTUISchema from './MQTT/uiSchema.jsx'
import OPCHDAUISchema from './OPCHDA/uiSchema.jsx'
import OPCUAUISchema from './OPCUA/uiSchema.jsx'
import FolderScannerUISchema from './FolderScanner/uiSchema.jsx'
import SQLFileUISchema from './SQLFile/uiSchema.jsx'

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
    case 'OPCHDA':
      return OPCHDAUISchema
    case 'OPCUA':
      return OPCUAUISchema
    case 'FolderScanner':
      return FolderScannerUISchema
    case 'SQLFile':
      return SQLFileUISchema
    default:
      console.error('protocol has no uiSchema')
      return {}
  }
}

export default uiSchema
