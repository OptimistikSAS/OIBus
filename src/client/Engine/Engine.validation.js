import { isIp, notEmpty, inRange, minLength, isHost, minValue } from '../../services/validation.service'

const validation = {
  engine: {
    engineName: notEmpty(),
    port: inRange(1, 65535),
    user: notEmpty('User'),
    password: minLength(3),
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
      password: notEmpty(),
    },
  },
}

export default validation
