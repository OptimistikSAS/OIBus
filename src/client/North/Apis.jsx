import OIConnect from '../../north/OIConnect/OIConnect.schema.jsx'
import AmazonS3 from '../../north/AmazonS3/AmazonS3.schema.jsx'
import Console from '../../north/Console/Console.schema.jsx'
import InfluxDB from '../../north/InfluxDB/InfluxDB.schema.jsx'
import OIAnalytics from '../../north/OIAnalytics/OIAnalytics.schema.jsx'
import TimescaleDB from '../../north/TimescaleDB/TimescaleDB.schema.jsx'
import MongoDB from '../../north/MongoDB/MongoDB.schema.jsx'
import MQTT from '../../north/MQTT/MQTT.schema.jsx'
import WATSYConnect from '../../north/WATSYConnect/WATSYConnect.schema.jsx'
import CsvToHttp from '../../north/CsvToHttp/CsvToHttp.schema.jsx'
import FileWriter from '../../north/FileWriter/FileWriter.schema.jsx'

const ApiSchemas = { OIConnect, AmazonS3, Console, InfluxDB, OIAnalytics, TimescaleDB, MongoDB, MQTT, WATSYConnect, CsvToHttp, FileWriter }

export default ApiSchemas
