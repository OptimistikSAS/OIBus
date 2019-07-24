module.exports = {
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
      enum: ['TimescaleDB'],
      default: 'Console',
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
    subscribedTo: {
      type: 'array',
      title: 'Subscribed To',
      items: { type: 'string' },
    },
  },
}
