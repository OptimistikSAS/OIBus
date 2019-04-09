module.exports = {
  title: 'Configure MQTT',
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
      enum: ['MQTT'],
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
    MQTT: {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          title: 'Server',
        },
        protocol: {
          type: 'string',
          title: 'Protocol',
        },
        port: {
          type: 'number',
          title: 'Port',
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
    points: {
      type: 'array',
      title: 'Points',
      items: {
        type: 'object',
        properties: {
          MQTT: {
            type: 'object',
            title: 'MQTT',
            properties: {
              topic: {
                type: 'string',
                title: 'Topic',
              },
            },
          },
          pointId: {
            title: 'Point ID',
            type: 'string',
          },
          doNotGroup: {
            title: 'Do Not Group',
            type: 'boolean',
            default: true,
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
