module.exports = {
  title: 'Configure Alive Signal',
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
      enum: ['AliveSignal'],
      default: 'Console',
    },
    AliveSignal: {
      type: 'object',
      title: 'Alive Signal',
      properties: {
        host: {
          type: 'string',
          title: 'Host',
          default: 'https://demo.oianalytics.fr/api/optimistik/oibus',
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
        id: {
          type: 'string',
          title: 'ID',
        },
        frequency: {
          type: 'number',
          title: 'Frequency',
          default: 10000,
        },
        proxy: {
          type: 'string',
          title: 'Proxy',
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
