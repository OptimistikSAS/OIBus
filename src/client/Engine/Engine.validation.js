import type from '../helpers/validation'

const validation = {
  engine: {
    port: (val) => (val >= 1 && val <= 65535 ? null : 'value should be between 1 and 65535'),
    user: (val) => ((val && val.length > 0) ? null : 'user should not be empty'),
    password: (val) => ((val && val.length > 3) ? null : 'Length should be greater than 3'),
    filter: (val) => ((val && val.length > 0) ? null : 'filter should bnot be empty'),
    logParameters: {
      filename: type.string,
      maxsize: type.number,
      maxFiles: (val) => ((val >= 1) && (val <= 10) ? null : 'value should be between 1 and 10'),
      sqliteFilename: type.string,
      sqliteMaxFileSize: type.number,
    },
    scanModes: {
      scanMode: (val) => ((val && val.length > 0) ? null : 'scanMode should not be empty'),
      cronTime: (val) => ((val && val.length > 0) ? null : 'cron time should not be empty'),
    },
    caching: {
      cacheFolder: type.string,
      archiveFolder: type.string,
    },
    proxies: {
      name: (val) => (/^.{2,}$/.test(val) ? null : 'Length should be greater than 2'),
      host: (val) => (/^.{2,}$/.test(val) ? null : 'Length should be greater than 2'),
      port: (val) => (val >= 1 && val <= 65535 ? null : 'value should be between 1 and 65535'),
      username: (val) => (/^.{2,}$/.test(val) ? null : 'Length should be greater than 2'),
      password: (val) => (/^.{2,}$/.test(val) ? null : 'Length should be greater than 2'),
    },
  },
}

export default validation
