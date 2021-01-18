import OIConnect from '../../north/oiconnect/OIConnect.schema.jsx'
import AmazonS3 from '../../north/amazon/AmazonS3.schema.jsx'
import Console from '../../north/console/Console.schema.jsx'
import InfluxDB from '../../north/influxdb/InfluxDB.schema.jsx'
import OIAnalytics from '../../north/oianalytics/OIAnalytics.schema.jsx'
import TimescaleDB from '../../north/timescaledb/TimescaleDB.schema.jsx'
import MongoDB from '../../north/mongodb/MongoDB.schema.jsx'
import MQTTNorth from '../../north/mqttnorth/MQTTNorth.schema.jsx'
import WATSYConnect from '../../north/watsyconnect/WATSYConnect.schema.jsx'
import CsvToHttp from '../../north/CsvToHttp/CsvToHttp.schema.jsx'
import FileWriter from '../../north/filewriter/FileWriter.schema.jsx'

const ApiSchemas = { OIConnect, AmazonS3, Console, InfluxDB, OIAnalytics, TimescaleDB, MongoDB, MQTTNorth, WATSYConnect, CsvToHttp, FileWriter }

export default ApiSchemas
