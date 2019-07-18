module.exports = {
  title: 'Configure OPCHDA',
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
      title: 'Protocol',
      default: 'OPCHDA',
    },
    agentFilename: {
      type: 'string',
      title: 'Agent Filename',
    },
    tcpPort: {
      type: 'number',
      title: 'TCP Port',
    },
    host: {
      type: 'string',
      title: 'Host',
    },
    serverName: {
      type: 'string',
      title: 'Server Name',
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
            default: 'everySecond',
          },
        },
      },
    },
    scanGroups: {
      type: 'array',
      title: 'Scan Groups',
      items: {
        type: 'object',
        properties: {
          scanMode: {
            title: 'Scan Mode',
            type: 'string',
            default: 'everySecond',
          },
          aggregate: {
            title: 'Aggregate',
            type: 'string',
          },
          resampling: {
            title: 'Resampling',
            type: 'string',
          },
        },
      },
    },
  },
}
