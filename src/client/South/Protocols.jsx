import CSV from '../../south/CSV/CSV.def.jsx'
import Modbus from '../../south/Modbus/Modbus.Form.jsx'
import MQTT from '../../south/MQTT/MQTT.Form.jsx'
import OPCHDA from '../../south/OPCHDA/OPCHDA.Form.jsx'
import OPCUA from '../../south/OPCUA/OPCUA.Form.jsx'
import FolderScanner from '../../south/FolderScanner/FolderScanner.Form.jsx'
import SQLDbToFile from '../../south/SQLDbToFile/SQLDbToFile.Form.jsx'

const ProtocolForms = { Modbus, MQTT, OPCHDA, OPCUA, FolderScanner, SQLDbToFile }
const ProtocolDefs = { CSV }

export { ProtocolForms, ProtocolDefs }
