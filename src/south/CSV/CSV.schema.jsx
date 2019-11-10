import React from 'react'
import { notEmpty, length } from '../../services/validation.service'

const schema = { name: 'CSV' }
schema.form = {
  inputFolder: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Input Folder',
    valid: notEmpty(),
    defaultValue: './csv/input',
    help: <div>Path to the input folder</div>,
  },
  archiveFolder: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Archive Folder',
    valid: notEmpty(),
    defaultValue: './csv/archive',
    help: <div>Path to the archive folder</div>,
  },
  errorFolder: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Error Folder',
    valid: notEmpty(),
    defaultValue: './csv/error',
    help: <div>Path to the error folder</div>,
  },
  separator: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'CSV separator',
    valid: length(1),
    defaultValue: ',',
    help: <div>(often , or ;)</div>,
  },
  timeColumn: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'time column',
    valid: notEmpty(),
    defaultValue: '1',
    help: <div>Column with the timestamp</div>,
  },
  hasFirstLine: {
    type: 'OIbCheckBox',
    newRow: true,
    md: 4,
    label: 'Has first line',
    valid: notEmpty(),
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
  scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
  value: {
    type: 'OIbText',
    label: 'Value',
    defaultValue: '',
    valid: notEmpty(),
  },
  quality: {
    type: 'OIbText',
    label: 'Quality',
    defaultValue: '',
    valid: notEmpty(),
  },
}

export default schema
