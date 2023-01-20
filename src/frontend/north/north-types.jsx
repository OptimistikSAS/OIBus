import OIConnect from '../../north/north-oiconnect/north-oiconnect.schema.jsx'
import AmazonS3 from '../../north/north-amazon-s3/north-amazon-s3.schema.jsx'
import Console from '../../north/north-console/north-console.schema.jsx'
import InfluxDB from '../../north/north-influx-db/north-influx-db.schema.jsx'
import OIAnalytics from '../../north/north-oianalytics/north-oianalytics.schema.jsx'
import TimescaleDB from '../../north/north-timescale-db/north-timescale-db.schema.jsx'
import MongoDB from '../../north/north-mongo-db/north-mongo-db.schema.jsx'
import MQTT from '../../north/north-mqtt/north-mqtt.schema.jsx'
import WATSYConnect from '../../north/north-watsy/north-watsy.schema.jsx'
import CsvToHttp from '../../north/north-csv-to-http/north-csv-to-http.schema.jsx'
import FileWriter from '../../north/north-file-writer/north-file-writer.schema.jsx'
import RestApi from '../../north/north-rest/north-rest.schema.jsx'

const NorthSchemas = { OIConnect, AmazonS3, Console, InfluxDB, OIAnalytics, TimescaleDB, MongoDB, MQTT, WATSYConnect, CsvToHttp, FileWriter, RestApi }

export default NorthSchemas
