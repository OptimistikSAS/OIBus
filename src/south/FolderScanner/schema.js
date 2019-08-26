module.exports = {
  title: 'Configure FolderScanner',
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
      enum: ['FolderScanner'],
      title: 'Protocol',
      default: 'FolderScanner',
    },
    inputFolder: {
      type: 'string',
      title: 'Input Folder',
    },
    preserveFiles: {
      type: 'boolean',
      title: 'Preserve Files',
      default: true,
    },
    minAge: {
      type: 'number',
      title: 'Minimum Age',
      default: 1000,
    },
    regex: {
      type: 'string',
      title: 'Regex',
      default: '.txt',
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
            default: 'every5Second',
          },
        },
      },
    },
  },
}
