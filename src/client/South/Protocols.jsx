import CSV from '../../south/CSV/CSV.schema.jsx'
import Modbus from '../../south/Modbus/Modbus.Form.jsx'
import MQTT from '../../south/MQTT/MQTT.schema.jsx'
import OPCHDA from '../../south/OPCHDA/OPCHDA.Form.jsx'
import OPCUA from '../../south/OPCUA/OPCUA.Form.jsx'
import FolderScanner from '../../south/FolderScanner/FolderScanner.Form.jsx'
import SQLDbToFile from '../../south/SQLDbToFile/SQLDbToFile.Form.jsx'

const ProtocolForms = { Modbus, MQTT, OPCHDA, OPCUA, FolderScanner, SQLDbToFile }
const ProtocolSchemas = { CSV, MQTT }

export { ProtocolForms, ProtocolSchemas }
