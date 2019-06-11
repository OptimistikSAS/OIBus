module.exports = {
  title: 'Configure CSV',
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
      enum: ['CSV'],
      title: 'Protocol',
      default: 'CSV',
    },
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
          },
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
    },
  },
}
