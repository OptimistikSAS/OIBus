import ADS from '../../south/ADS/ADS.schema.jsx'
import Modbus from '../../south/Modbus/Modbus.schema.jsx'
import MQTT from '../../south/MQTT/MQTT.schema.jsx'
import OPCHDA from '../../south/OPCHDA/OPCHDA.schema.jsx'
import OPCUA_HA from '../../south/OPCUA_HA/OPCUA_HA.schema.jsx'
import OPCUA_DA from '../../south/OPCUA_DA/OPCUA_DA.schema.jsx'
import FolderScanner from '../../south/FolderScanner/FolderScanner.schema.jsx'
import SQLDbToFile from '../../south/SQLDbToFile/SQLDbToFile.schema.jsx'

const ProtocolSchemas = { ADS, OPCUA_HA, OPCUA_DA, OPCHDA, MQTT, Modbus, FolderScanner, SQLDbToFile }

export default ProtocolSchemas
