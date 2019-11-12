import CSV from '../../south/CSV/CSV.schema.jsx'
import Modbus from '../../south/Modbus/Modbus.schema.jsx'
import MQTT from '../../south/MQTT/MQTT.schema.jsx'
import OPCHDA from '../../south/OPCHDA/OPCHDA.schema.jsx'
import OPCUA from '../../south/OPCUA/OPCUA.schema.jsx'
import FolderScanner from '../../south/FolderScanner/FolderScanner.schema.jsx'
import SQLDbToFile from '../../south/SQLDbToFile/SQLDbToFile.schema.jsx'

const ProtocolSchemas = { OPCUA, OPCHDA, CSV, MQTT, Modbus, FolderScanner, SQLDbToFile }

export default ProtocolSchemas
