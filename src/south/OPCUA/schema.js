module.exports = {
  title: 'Configure OPCUA',
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
      enum: ['OPCUA'],
      title: 'Protocol',
      default: 'CSV',
    },
    host: {
      type: 'string',
      title: 'Host',
      oneOf: [{ format: 'ipv4' }, { format: 'ipv6' }],
    },
    opcuaPort: {
      type: 'number',
      title: 'OPCUA Port',
    },
    httpsPort: {
      type: 'number',
      title: 'HTTPS Port',
    },
    endPoint: {
      type: 'string',
      title: 'Endpoint',
    },
    timeOrigin: {
      type: 'string',
      title: 'Time Origin',
      default: 'server',
    },
    points: {
      type: 'array',
      title: 'Points',
      items: {
        type: 'object',
        properties: {
          OPCUAnodeId: {
            type: 'object',
            title: 'OPCUA Node ID',
            properties: {
              ns: {
                type: 'number',
                title: 'NS',
              },
              s: {
                type: 'string',
                title: 'S',
                default: 'Counter1',
              },
            },
          },
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
  },
}
