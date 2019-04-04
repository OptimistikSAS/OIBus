const aliveSignalSchema = {
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
      enum: ['Console', 'InfluxDB', 'RawFileSender', 'TimescaleDB', 'AmazonS3', 'AliveSignal'],
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
          type: 'object',
          title: 'Proxy',
          properties: {
            host: {
              type: 'string',
              title: 'Host',
              default: 'http://localhost',
            },
            port: {
              type: 'number',
              title: 'Port',
              default: 8888,
            },
            username: {
              type: 'string',
              title: 'Username',
              default: 'user',
            },
            password: {
              type: 'string',
              title: 'Password',
              default: 'password',
            },
          },
        },
      },
    },
  },
}

export default aliveSignalSchema
