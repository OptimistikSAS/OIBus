import OIConnect from '../../north/oiconnect/OIConnect.schema.jsx'
import AmazonS3 from '../../north/amazon/AmazonS3.schema.jsx'
import Console from '../../north/console/Console.schema.jsx'
import InfluxDB from '../../north/influxdb/InfluxDB.schema.jsx'
import OIAnalyticsFile from '../../north/oianalyticsfile/OIAnalyticsFile.schema.jsx'
import TimescaleDB from '../../north/timescaledb/TimescaleDB.schema.jsx'
import MongoDB from '../../north/mongodb/MongoDB.schema.jsx'
import MQTTNorth from '../../north/mqttnorth/MQTTNorth.schema.jsx'

const ApiSchemas = { OIConnect, AmazonS3, Console, InfluxDB, OIAnalyticsFile, TimescaleDB, MongoDB, MQTTNorth }

export default ApiSchemas
