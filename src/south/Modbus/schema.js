module.exports = {
  title: 'Configure Modbus',
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
      enum: ['Modbus'],
      title: 'Protocol',
      default: 'CSV',
    },
    host: {
      type: 'string',
      title: 'Host',
      oneOf: [{ format: 'ipv4' }, { format: 'ipv6' }],
    },
    port: {
      type: 'number',
      title: 'Port',
    },
    points: {
      type: 'array',
      title: 'Points',
      items: {
        type: 'object',
        properties: {
          Modbus: {
            type: 'object',
            title: 'Modbus',
            properties: {
              address: {
                type: 'string',
                title: 'Address',
              },
              type: {
                type: 'string',
                title: 'Type',
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
          },
        },
      },
    },
  },
}
