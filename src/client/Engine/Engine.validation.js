import { isIp, notEmpty, inRange, minLength, isHost, minValue, hasLengthBetween } from '../../services/validation.service'

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
      scanMode: notEmpty('ScanMode'),
      cronTime: notEmpty('Cron'),
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
    httpRequest: { timeout: minValue(1) },
  },
}

export default validation
