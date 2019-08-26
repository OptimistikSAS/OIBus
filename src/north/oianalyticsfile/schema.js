module.exports = {
  title: 'Configure OIAnalyticsFile',
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
      enum: ['OIAnalyticsFile'],
      default: 'OIAnalyticsFile',
    },
    OIAnalyticsFile: {
      type: 'object',
      title: 'OIAnalyticsFile',
      properties: {
        host: {
          type: 'string',
          title: 'Host',
          default: 'https://demo.oianalytics.fr',
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
        stack: {
          type: 'string',
          title: 'Stack',
          enum: ['axios', 'request', 'fetch'],
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
