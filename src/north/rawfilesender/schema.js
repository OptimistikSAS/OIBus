module.exports = {
  title: 'Configure RawFileSender',
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
      enum: ['RawFileSender'],
      default: 'Console',
    },
    RawFileSender: {
      type: 'object',
      title: 'RawFileSender',
      properties: {
        host: {
          type: 'string',
          title: 'Host',
          default: 'https://demo.oianalytics.fr/',
        },
        endpoint: {
          type: 'string',
          title: 'Endpoint',
          default: '/api/optimistik/data/values/upload',
        },
        authentication: {
          type: 'object',
          title: 'Authentication',
          properties: {
            type: {
              type: 'string',
              title: 'Type',
              default: 'Basic',
            },
            username: {
              type: 'string',
              title: 'Username',
            },
            password: {
              type: 'string',
              title: 'Password',
            },
          },
        },
        proxy: {
          type: 'string',
          title: 'Proxy',
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
          default: 5000,
        },
        retryInterval: {
          type: 'number',
          title: 'Retry interval',
          default: 10000,
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
