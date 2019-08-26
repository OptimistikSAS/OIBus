import CSVUISchema from './CSV/uiSchema.jsx'
import ModbusUISchema from './Modbus/uiSchema.jsx'
import MQTTUISchema from './MQTT/uiSchema.jsx'
import OPCHDAUISchema from './OPCHDA/uiSchema.jsx'
import OPCUAUISchema from './OPCUA/uiSchema.jsx'
import SQLDbToFileUISchema from './SQLDbToFile/uiSchema.jsx'
import FolderScannerUISchema from './FolderScanner/uiSchema.jsx'

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
    case 'SQLDbToFile':
      return SQLDbToFileUISchema
    case 'FolderScanner':
      return FolderScannerUISchema
    default:
      console.error('protocol has no uiSchema')
      return {}
  }
}

export default uiSchema
