const timescaleDbSchema = {
  title: 'Configure TimescaleDB',
  type: 'object',
  properties: {
    applicationId: {
      type: 'string',
      title: 'Application ID',
    },
    enabled: {
      type: 'boolean',
      title: 'Enabled',
      default: true,
    },
    api: {
      type: 'string',
      title: 'API',
      enum: ['Console', 'InfluxDB', 'RawFileSender', 'TimescaleDB', 'AmazonS3', 'AliveSignal'],
      default: 'Console',
    },
    minimumBuffer: {
      type: 'number',
      title: 'Minimum buffer',
      default: 10,
    },
    TimescaleDB: {
      type: 'object',
      title: 'TimescaleDB',
      properties: {
        user: {
          type: 'string',
          title: 'Username',
          default: 'user',
        },
        password: {
          type: 'string',
          title: 'Password',
          default: 'password',
        },
        db: {
          type: 'string',
          title: 'Database',
        },
        host: {
          type: 'string',
          title: 'Host',
          default: 'http://localhost',
        },
      },
    },
    caching: {
      type: 'object',
      title: 'Caching',
      properties: {
        sendInterval: {
          type: 'number',
          title: 'Send interval',
          default: 15000,
        },
        retryInterval: {
          type: 'number',
          title: 'Retry interval',
          default: 10000,
        },
        groupCount: {
          type: 'number',
          title: 'Group count',
          default: 6,
        },
      },
    },
  },
}

export default timescaleDbSchema
