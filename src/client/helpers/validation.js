const type = {
  string: (val) => ((typeof val === 'string' || val instanceof String) ? null : 'value should be a string'),
  number: (val) => ((typeof val === 'number' || val instanceof Number) ? null : 'value should be a number'),
  stringOrNumber: (val) => ((typeof val === 'number' || val instanceof Number)
                        || (typeof val === 'string' || val instanceof String) ? null : 'value should be a number'),
}

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
  north: {
    caching: {
      sendInterval: type.number,
      retryInterval: type.number,
      groupCount: type.number,
      maxSendCount: type.number,
    },
    AliveSignal: {
      host: type.string,
      authentication: {
        username: type.string,
        password: type.string,
      },
      id: type.string,
      frequency: type.number,
      proxy: type.string,
    },
    AmazonS3: {
      bucket: type.string,
      folder: type.string,
      authentication: {
        accessKey: type.string,
        secretKey: type.string,
      },
      proxy: type.string,
    },
    InfluxDB: {
      user: type.string,
      password: type.string,
      db: type.string,
      host: type.string,
      precision: type.string,
    },
    OIAnalyticsFile: {
      host: type.string,
      endpoint: type.string,
      authentication: {
        username: type.string,
        password: type.string,
      },
      proxy: type.string,
    },
    OIConnect: {
      host: type.string,
      endpoint: type.string,
      authentication: {
        username: type.string,
        password: type.string,
      },
      proxy: type.string,
    },
    TimescaleDB: {
      user: type.string,
      password: type.string,
      db: type.string,
      host: type.string,
    },
  },
  south: {
    CSV: {
      inputFolder: type.string,
      archiveFolder: type.string,
      errorFolder: type.string,
      separator: type.string,
      timeColumn: type.number,
      points: {
        pointId: type.string,
        value: type.stringOrNumber,
        quality: type.stringOrNumber,
      },
    },
    FolderScanner: {
      inputFolder: type.string,
      minAge: type.number,
      regex: type.string,
    },
    Modbus: {
      host: type.string,
      port: type.number,
      points: {
        pointId: type.string,
        address: type.string,
      },
    },
    MQTT: {
      server: type.string,
      port: type.number,
      username: type.string,
      password: type.string,
      points: {
        pointId: type.string,
        topic: type.string,
      },
    },
    OPCHDA: {
      agentFilename: type.string,
      tcpPort: type.number,
      host: type.string,
      serverName: type.string,
      retryInterval: type.number,
      points: { pointId: type.string },
    },
    OPCUA: {
      host: type.string,
      opcuaPort: type.number,
      httpsPort: type.number,
      endPoint: type.string,
      points: {
        pointId: type.string,
        ns: type.number,
        s: type.string,
      },
    },
    SQLDbToFile: {
      host: type.string,
      post: type.number,
      username: type.string,
      password: type.string,
      database: type.string,
      query: type.string,
      connectionTimeout: type.number,
      requestTimeout: type.number,
      delimiter: type.string,
      filename: type.string,
    },
  },
}

export default validation
