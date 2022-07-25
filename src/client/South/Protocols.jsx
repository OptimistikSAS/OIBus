import ADS from '../../south/ADS/ADS.schema'
import Modbus from '../../south/Modbus/Modbus.schema'
import MQTT from '../../south/MQTT/MQTT.schema'
import OPCHDA from '../../south/OPCHDA/OPCHDA.schema'
import OPCUA_HA from '../../south/OPCUA_HA/OPCUA_HA.schema'
import OPCUA_DA from '../../south/OPCUA_DA/OPCUA_DA.schema'
import FolderScanner from '../../south/FolderScanner/FolderScanner.schema'
import SQL from '../../south/SQL/SQL.schema'
import RestApi from '../../south/RestApi/RestApi.schema'

const ProtocolSchemas = { ADS, OPCUA_HA, OPCUA_DA, OPCHDA, MQTT, Modbus, FolderScanner, SQL, RestApi }

export default ProtocolSchemas
