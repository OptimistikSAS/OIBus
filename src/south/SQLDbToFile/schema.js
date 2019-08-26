module.exports = {
  title: 'Configure SQLDbToFile',
  type: 'object',
  properties: {
    dataSourceId: {
      type: 'string',
      title: 'Data Source ID',
    },
    enabled: {
      type: 'boolean',
      title: 'Enabled',
      default: true,
    },
    protocol: {
      type: 'string',
      enum: ['SQLDbToFile'],
      title: 'Protocol',
      default: 'SQLDbToFile',
    },
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
    database: {
      type: 'string',
      title: 'Database',
    },
    query: {
      type: 'string',
      title: 'Query',
    },
    connectionTimeout: {
      type: 'number',
      title: 'Connection timeout',
      default: 1000,
    },
    requestTimeout: {
      type: 'number',
      title: 'Request timeout',
      default: 1000,
    },
    delimiter: {
      type: 'string',
      title: 'Delimiter',
      default: ',',
    },
    filename: {
      type: 'string',
      title: 'Filename',
      default: 'sql-@date.csv',
    },
    scanMode: {
      title: 'Scan Mode',
      type: 'string',
      default: 'every5Second',
    },
  },
}
