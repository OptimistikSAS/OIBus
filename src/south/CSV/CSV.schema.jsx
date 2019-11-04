import React from 'react'

const schema = { name: 'CSV' }
schema.form = {
  inputFolder: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Input Folder',
    valid: (val) => (val && val.length > 0 ? null : 'Input Folder should not be empty'),
    defaultValue: './csv/input',
    help: <div>Path to the input folder</div>,
  },
  archiveFolder: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Archive Folder',
    valid: (val) => (val && val.length > 0 ? null : 'Archive Folder should not be empty'),
    defaultValue: './csv/archive',
    help: <div>Path to the archive folder</div>,
  },
  errorFolder: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Error Folder',
    valid: (val) => (val && val.length > 0 ? null : 'Error Folder should not be empty'),
    defaultValue: './csv/error',
    help: <div>Path to the error folder</div>,
  },
  separator: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'CSV separator',
    valid: (val) => (val && val.length === 1 ? null : 'Length should be 1'),
    defaultValue: ',',
    help: <div>(often , or ;)</div>,
  },
  timeColumn: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'time column',
    valid: (val) => ((val && val.length > 0) || val === 0 || val >= 1 ? null : 'Value should not be empty'),
    defaultValue: '1',
    help: <div>Column with the timestamp</div>,
  },
  hasFirstLine: {
    type: 'OIbCheckBox',
    newRow: true,
    md: 4,
    label: 'Has first line',
    valid: (val) => ((val && val.length > 0) || val === 0 || val >= 1 ? null : 'Value should not be empty'),
    defaultValue: true,
    help: <div>indicates if the file starts with a header line</div>,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    label: 'Point Id',
    valid: (val) => (val && val.length > 0 ? null : 'Point Id should not be empty'),
    defaultValue: '',
  },
  scanMode: { type: 'OIbScanMode' },
  value: {
    type: 'OIbText',
    valid: (val) => ((val && val.length > 0) || val === 0 || val >= 1 ? null : 'Value should not be empty'),
  },
  quality: {
    type: 'OIbText',
    valid: (val) => ((val && val.length > 0) || val === 0 || val >= 1 ? null : 'Quality should not be empty'),
  },
}

export default schema
