const amazonSchema = {
  title: 'Configure AmazonS3',
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
    AmazonS3: {
      type: 'object',
      title: 'AmazonS3',
      properties: {
        bucket: {
          type: 'string',
          title: 'Bucket',
          default: 'optimistik.test',
        },
        folder: {
          type: 'string',
          title: 'Folder',
          default: 'oi_bus_test',
        },
        authentication: {
          type: 'object',
          title: 'Authentication',
          properties: {
            accessKey: {
              type: 'string',
              title: 'Access key',
            },
            secretKey: {
              type: 'string',
              title: 'Secret key',
            },
          },
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
              default: 8080,
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
  },
}

export default amazonSchema
