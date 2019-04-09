module.exports = {
  title: 'Configure CSV',
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
      enum: ['CSV'],
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
    CSV: {
      type: 'object',
      properties: {
        inputFolder: {
          type: 'string',
          title: 'Input Folder',
        },
        archiveFolder: {
          type: 'string',
          title: 'Archive Folder',
        },
        errorFolder: {
          type: 'string',
          title: 'Error Folder',
        },
        separator: {
          type: 'string',
          title: 'Separator',
          default: ',',
        },
        timeColumn: {
          type: 'number',
          title: 'Time Column',
          default: 0,
        },
        hasFirstLine: {
          type: 'boolean',
          title: 'Has First Line',
          default: true,
        },
      },
    },
    points: {
      type: 'array',
      title: 'Points',
      items: {
        type: 'object',
        properties: {
          CSV: {
            type: 'object',
            title: 'CSV',
            properties: {
              value: {
                type: 'string', // TODO: Multiple types
                title: 'Value',
              },
              quality: {
                type: 'string', // TODO: Multiple types
                title: 'Quality',
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
