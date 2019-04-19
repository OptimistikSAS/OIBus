module.exports = {
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
      enum: ['AmazonS3'],
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
        defaultProxy: {
          type: 'string',
          title: 'Default proxy',
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
