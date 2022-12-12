import ADS from '../../south/south-ads/south-ads.schema.jsx'
import Modbus from '../../south/south-modbus/south-modbus.schema.jsx'
import MQTT from '../../south/south-mqtt/south-mqtt.schema.jsx'
import OPCHDA from '../../south/south-opchda/south-opchda.schema.jsx'
import OPCUA_HA from '../../south/south-opcua-ha/south-opcua-ha.schema.jsx'
import OPCUA_DA from '../../south/south-opcua-da/south-opcua-da.schema.jsx'
import FolderScanner from '../../south/south-folder-scanner/south-folder-scanner.schema.jsx'
import SQL from '../../south/south-sql/south-sql.schema.jsx'
import RestApi from '../../south/south-rest/south-rest.schema.jsx'

const SouthSchemas = { ADS, OPCUA_HA, OPCUA_DA, OPCHDA, MQTT, Modbus, FolderScanner, SQL, RestApi }

export default SouthSchemas
