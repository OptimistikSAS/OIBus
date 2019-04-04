import consoleSchema from './console/schema'
import amazonSchema from './amazon/schema'
import influxDbSchema from './influxdb/schema'
import timescaleDbSchema from './timescaledb/schema'
import rawFileSenderSchema from './rawfilesender/schema'
import aliveSignalSchema from './alivesignal/schema'

function getScheme(api) {
  switch (api) {
    case 'Console':
      return consoleSchema
    case 'AmazonS3':
      return amazonSchema
    case 'InfluxDB':
      return influxDbSchema
    case 'TimescaleDB':
      return timescaleDbSchema
    case 'RawFileSender':
      return rawFileSenderSchema
    case 'AliveSignal':
      return aliveSignalSchema

    default:
      return consoleSchema
  }
}

// eslint-disable-next-line import/prefer-default-export
export { getScheme }
