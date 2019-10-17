const validation = {
  engine: {
    port: (val) => (val >= 1 && val <= 65535 ? null : 'Value should be between 1 and 65535'),
    user: (val) => ((val && val.length > 0) ? null : 'User should not be empty'),
    password: (val) => ((val && val.length > 3) ? null : 'Length should be greater than 3'),
    filter: (val) => ((val && val.length > 0) ? null : 'Filter should not be empty'),
    logParameters: {
      filename: (val) => ((val && val.length > 0) ? null : 'Filename should not be empty'),
      maxsize: (val) => (val >= 10000 ? null : 'File Max size should be greater or equal to 10000'),
      maxFiles: (val) => ((val >= 1) && (val <= 10) ? null : 'Value should be between 1 and 10'),
      sqliteFilename: (val) => ((val && val.length > 0) ? null : 'Filename of sqlite db should not be empty'),
      sqliteMaxFileSize: (val) => (val >= 10000 ? null : 'Db Max size should be greater or equal to 10000'),
    },
    scanModes: {
      scanMode: (val) => ((val && val.length > 0) ? null : 'ScanMode should not be empty'),
      cronTime: (val) => ((val && val.length > 0) ? null : 'Cron time should not be empty'),
    },
    caching: {
      cacheFolder: (val) => ((val && val.length > 0) ? null : 'Cache Folder should not be empty'),
      archiveFolder: (val) => ((val && val.length > 0) ? null : 'Archive Folder should not be empty'),
    },
    proxies: {
      name: (val) => (/^.{2,}$/.test(val) ? null : 'Length should be greater than 2'),
      host: (val) => (/^.{2,}$/.test(val) ? null : 'Length should be greater than 2'),
      port: (val) => (val >= 1 && val <= 65535 ? null : 'Value should be between 1 and 65535'),
      username: (val) => (/^.{2,}$/.test(val) ? null : 'Length should be greater than 2'),
      password: (val) => (/^.{2,}$/.test(val) ? null : 'Length should be greater than 2'),
    },
  },
}

export default validation
