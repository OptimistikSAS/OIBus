import { isIp, notEmpty, inRange, minLength, isHost, minValue, hasLengthBetween } from '../../services/validation.service'
import utils from '../helpers/utils'

const validation = {
  engine: {
    engineName: notEmpty(),
    port: inRange(1, 65535),
    user: notEmpty('User'),
    password: hasLengthBetween(4, 256),
    filter: (val) => isIp('Filter')(val === '*' ? '0.0.0.0' : val.replace(/\*/g, '0')), // replace * with a valid ip before testing
    logParameters: {
      filename: notEmpty('Filename'),
      maxsize: minValue(10000),
      maxFiles: inRange(1, 10),
      sqliteFilename: notEmpty('Filename of sqlite db'),
      sqliteMaxFileSize: minValue(10000),
    },
    scanModes: {
      scanMode: (val, excludedList) => {
        let error = null
        if (excludedList.includes(val)) {
          error = 'Scan mode already exists'
        }
        if (!error) {
          error = (((typeof val === 'string' || val instanceof String) && val !== '') ? null : 'Value must not be empty')
        }
        return error
      },
      cronTime: (val) => (
        utils.nextTime(val).length > 0 ? null : 'Cron value should be valid'
      ),
    },
    caching: {
      cacheFolder: notEmpty('Cache Folder'),
      archiveFolder: notEmpty('Archive Folder'),
    },
    proxies: {
      name: minLength(2),
      host: isHost(),
      port: inRange(1, 65535),
      username: notEmpty(),
      password: hasLengthBetween(0, 256),
    },
    aliveSignal: {
      host: notEmpty('Host'),
      endpoint: notEmpty('Endpoint'),
      id: notEmpty('Id'),
      frequency: inRange(60, 3600),
    },
    httpRequest: {
      timeout: minValue(1),
      retryCount: minValue(0),
    },
  },
}

export default validation
