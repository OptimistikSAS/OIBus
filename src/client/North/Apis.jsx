import OIConnect from '../../north/OIConnect/OIConnect.schema'
import AmazonS3 from '../../north/AmazonS3/AmazonS3.schema'
import Console from '../../north/Console/Console.schema'
import InfluxDB from '../../north/InfluxDB/InfluxDB.schema'
import OIAnalytics from '../../north/OIAnalytics/OIAnalytics.schema'
import TimescaleDB from '../../north/TimescaleDB/TimescaleDB.schema'
import MongoDB from '../../north/MongoDB/MongoDB.schema'
import MQTT from '../../north/MQTT/MQTT.schema'
import WATSYConnect from '../../north/WATSYConnect/WATSYConnect.schema'
import CsvToHttp from '../../north/CsvToHttp/CsvToHttp.schema'
import FileWriter from '../../north/FileWriter/FileWriter.schema'

const ApiSchemas = { OIConnect, AmazonS3, Console, InfluxDB, OIAnalytics, TimescaleDB, MongoDB, MQTT, WATSYConnect, CsvToHttp, FileWriter }

export default ApiSchemas
