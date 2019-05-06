module.exports = {
  title: 'Configure SQLFile',
  type: 'object',
  properties: {
    equipmentId: {
      type: 'string',
      title: 'Equipment ID',
    },
    enabled: {
      type: 'boolean',
      title: 'Enabled',
      default: true,
    },
    protocol: {
      type: 'string',
      enum: ['SQLFile'],
      title: 'Protocol',
      default: 'SQLFile',
    },
    pointIdRoot: {
      type: 'string',
      title: 'Point ID Root',
    },
    defaultScanMode: {
      type: 'string',
      title: 'Default Scan Mode',
      default: 'every20Second',
    },
    SQLFile: {
      type: 'object',
      properties: {
        driver: {
          type: 'string',
          enum: ['mssql', 'mysql', 'postgresql', 'oracle'],
          title: 'SQL driver',
          default: 'mssql',
        },
        host: {
          type: 'string',
          title: 'Host',
          default: 'localhost',
        },
        port: {
          type: 'number',
          title: 'Port',
          default: 1433,
        },
        username: {
          type: 'string',
          title: 'Username',
        },
        password: {
          type: 'string',
          title: 'Password',
        },
        query: {
          type: 'string',
          title: 'Query',
        },
        delimiter: {
          type: 'string',
          title: 'Delimiter',
          default: ',',
        },
        tmpFolder: {
          type: 'string',
          title: 'Temporarily folder',
        },
      },
    },
    points: {
      type: 'array',
      title: 'Points',
      items: {
        type: 'object',
        properties: {
          pointId: {
            title: 'Point ID',
            type: 'string',
          },
          scanMode: {
            title: 'Scan Mode',
            type: 'string',
            default: 'every5second',
          },
        },
      },
    },
  },
}
