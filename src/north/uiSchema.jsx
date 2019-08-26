import AliveSignalUISchema from './alivesignal/uiSchema.jsx'
import AmazonS3UISchema from './amazon/uiSchema.jsx'
import ConsoleUISchema from './console/uiSchema.jsx'
import InfluxDBUISchema from './influxdb/uiSchema.jsx'
import OIAnalyticsFileUISchema from './oianalyticsfile/uiSchema.jsx'
import OIConnect from './oiconnect/uiSchema.jsx'
import TimescaleDBUISchema from './timescaledb/uiSchema.jsx'

/**
 * Returns the uiSchema for the api
 * @param {String} api api name
 * @returns {object} uiSchema json
 */
const uiSchema = (api) => {
  switch (api) {
    case 'AliveSignal':
      return AliveSignalUISchema
    case 'AmazonS3':
      return AmazonS3UISchema
    case 'Console':
      return ConsoleUISchema
    case 'InfluxDB':
      return InfluxDBUISchema
    case 'OIAnalyticsFile':
      return OIAnalyticsFileUISchema
    case 'OIConnect':
      return OIConnect
    case 'TimescaleDB':
      return TimescaleDBUISchema
    default:
      console.error('api has no uiSchema')
      return {}
  }
}

export default uiSchema
