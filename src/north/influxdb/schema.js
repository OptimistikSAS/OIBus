module.exports = {
  title: 'Configure InfluxDB',
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
    },
    InfluxDB: {
      type: 'object',
      title: 'InfluxDB',
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
          default: 'http://localhost:8086',
        },
        precision: {
          type: 'string',
          title: 'Precision',
          default: 'ms',
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
          default: 10,
        },
        maxSendCount: {
          type: 'number',
          title: 'Max Send Count',
          default: 100,
        },
      },
    },
    subscribedTo: {
      type: 'array',
      title: 'Subscribed To',
      items: { type: 'string' },
    },
  },
}
