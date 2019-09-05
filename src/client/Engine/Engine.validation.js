import type from '../helpers/validation'

const validation = {
  engine: {
    port: (val) => (val >= 1 && val <= 65535 ? null : 'value should be between 1 and 65535'),
    user: (val) => ((val.length > 2) ? null : 'Length should be greater than 2'),
    password: (val) => (/^.{4,}$/.test(val) ? null : 'Length should be greater than 4'),
    filter: (val) => (/^.{2,}$/.test(val) ? null : 'Length should be greated than 2'),
    logParameters: {
      filename: type.string,
      maxsize: type.number,
      maxFiles: (val) => ((val >= 1) && (val <= 10) ? null : 'value should be between 1 and 10'),
      sqliteFilename: type.string,
      sqliteMaxFileSize: type.number,
    },
    scanModes: {
      scanMode: (val) => (/^.{2,}$/.test(val) ? null : 'Length should be greated than 2'),
      cronTime: (val) => (/^.{2,}$/.test(val) ? null : 'Length should be greated than 2'),
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
