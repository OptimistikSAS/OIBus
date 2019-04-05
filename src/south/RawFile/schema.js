const rawFileSchema = {
  title: 'Configure RawFile',
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
      enum: ['RawFile'],
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
    RawFile: {
      type: 'object',
      properties: {
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

export default rawFileSchema
