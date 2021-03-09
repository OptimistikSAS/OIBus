import { isIp, notEmpty, inRange, minLength, isHost, minValue, hasLengthBetween } from '../../services/validation.service'
import utils from '../helpers/utils'

const validation = {
  engine: {
    engineName: notEmpty(),
    port: inRange(1, 65535),
    user: notEmpty('User'),
    password: hasLengthBetween(4, 256),
    filter: (val) => isIp('Filter')(val === '*' ? '0.0.0.0' : val.replace(/\*/g, '0')), // replace * with a valid ip before testing
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
      archive: {
        archiveFolder: notEmpty('Archive Folder'),
        retentionDuration: minValue(0),
      },
      cacheFolder: notEmpty('Cache Folder'),
      bufferMax: minValue(0),
      bufferTimeoutInterval: minValue(10),
    },
    bulk: { bulkFolder: notEmpty('Bulk Folder') },
    proxies: {
      name: minLength(2),
      host: isHost(),
      port: inRange(1, 65535),
      username: notEmpty(),
      password: hasLengthBetween(0, 256),
    },
    healthSignal: {
      http: {
        host: notEmpty('Host'),
        endpoint: notEmpty('Endpoint'),
        frequency: inRange(60, 3600),
      },
      logging: { frequency: inRange(60, 3600) },
    },
    httpRequest: {
      timeout: minValue(1),
      retryCount: minValue(0),
    },
    externalSources: { id: notEmpty('External source') },
  },
}

export default validation
