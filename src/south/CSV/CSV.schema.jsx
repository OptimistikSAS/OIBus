import React from 'react'
import { notEmpty, length } from '../../services/validation.service'

const schema = { name: 'CSV' }
schema.form = {
  inputFolder: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: './csv/input',
    help: <div>Path to the input folder</div>,
  },
  archiveFolder: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: './csv/archive',
    help: <div>Path to the archive folder</div>,
  },
  errorFolder: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: './csv/error',
    help: <div>Path to the error folder</div>,
  },
  separator: {
    type: 'OIbText',
    md: 2,
    label: 'CSV separator',
    valid: length(1),
    defaultValue: ',',
    help: <div>(often , or ;)</div>,
  },
  timeColumn: {
    type: 'OIbText',
    newRow: false,
    md: 2,
    valid: notEmpty(),
    defaultValue: '1',
    help: <div>Column with the timestamp</div>,
  },
  hasFirstLine: {
    type: 'OIbCheckBox',
    md: 2,
    newRow: false,
    defaultValue: true,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: (val) => (val?.length > 0 ? null : 'Point Id should not be empty'),
    defaultValue: '',
  },
  scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
  value: {
    type: 'OIbText',
    defaultValue: '',
    valid: notEmpty(),
  },
  quality: {
    type: 'OIbText',
    defaultValue: '',
    valid: notEmpty(),
  },
}

export default schema
