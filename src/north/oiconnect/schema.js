module.exports = {
  title: 'Configure OIConnect',
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
      enum: ['OIConnect'],
      default: 'OIConnect',
    },
    OIConnect: {
      type: 'object',
      title: 'OIConnect',
      properties: {
        host: {
          type: 'string',
          title: 'Host',
          default: 'http://localhost:2223',
        },
        endpoint: {
          type: 'string',
          title: 'Endpoint',
          default: '/engine/addValues',
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
        maxSendCount: {
          type: 'number',
          title: 'Max send count',
          default: 20,
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
