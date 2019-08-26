import CSV from '../../south/CSV/CSV.Form.jsx'
import Modbus from '../../south/Modbus/Modbus.Form.jsx'
import MQTT from '../../south/MQTT/MQTT.Form.jsx'
import OPCHDA from '../../south/OPCHDA/OPCHDA.Form.jsx'
import OPCUA from '../../south/OPCUA/OPCUA.Form.jsx'
import RawFile from '../../south/FolderScanner/FolderScanner.Form.jsx'
import SQLFile from '../../south/SQLDbToFile/SQLDbToFile.Form.jsx'

const ProtocolForms = { CSV, Modbus, MQTT, OPCHDA, OPCUA, RawFile, SQLFile }

export default ProtocolForms
