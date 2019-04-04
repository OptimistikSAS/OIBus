const consoleSchema = {
  title: 'Configure Console',
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
      default: 1,
    },
    timeStamp: {
      type: 'string',
      title: 'Timestamp',
      default: 'OIBus',
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

export default consoleSchema
