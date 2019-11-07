import CSV from '../../south/CSV/CSV.schema.jsx'
import Modbus from '../../south/Modbus/Modbus.schema.jsx'
import MQTT from '../../south/MQTT/MQTT.schema.jsx'
import OPCHDA from '../../south/OPCHDA/OPCHDA.schema.jsx'
import OPCUA from '../../south/OPCUA/OPCUA.Form.jsx'
import FolderScanner from '../../south/FolderScanner/FolderScanner.schema.jsx'
import SQLDbToFile from '../../south/SQLDbToFile/SQLDbToFile.Form.jsx'

const ProtocolForms = { OPCUA, SQLDbToFile }
const ProtocolSchemas = { OPCHDA, CSV, MQTT, Modbus, FolderScanner }

export { ProtocolForms, ProtocolSchemas }
