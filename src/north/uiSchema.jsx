import AliveSignalUISchema from './alivesignal/uiSchema.jsx'
import AmazonS3UISchema from './amazon/uiSchema.jsx'
import ConsoleUISchema from './console/uiSchema.jsx'
import InfluxDBUISchema from './influxdb/uiSchema.jsx'
import Link from './link/uiSchema.jsx'
import RawFileSenderUISchema from './rawfilesender/uiSchema.jsx'
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
    case 'Link':
      return Link
    case 'RawFileSender':
      return RawFileSenderUISchema
    case 'TimescaleDB':
      return TimescaleDBUISchema
    default:
      console.error('api has no uiSchema')
      return {}
  }
}

export default uiSchema
