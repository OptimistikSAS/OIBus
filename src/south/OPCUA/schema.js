const OpcuaScheme = {
  title: 'Configure OPCUA',
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
      enum: ['CSV', 'MQTT', 'OPCUA', 'RawFile', 'Modbus'],
      title: 'Protocol',
      default: 'CSV',
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
    OPCUA: {
      type: 'object',
      properties: {
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
      },
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

export default OpcuaScheme
