import React from 'react'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'FolderScanner' }
schema.form = {
  inputFolder: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Input Folder',
    valid: notEmpty(),
    defaultValue: './input',
    help: <div>Path to the input folder</div>,
  },
  scanMode: { md: 4, newRow: false, type: 'OIbScanMode', label: 'Scan Mode' },
  preserve: {
    type: 'OIbCheckBox',
    newRow: true,
    md: 4,
    label: 'Preserve File?',
    valid: (val) => (val === true || val === false ? null : 'Preserve must be a boolean'),
    defaultValue: true,
    help: <div>Preserve the file</div>,
  },
  minAge: {
    type: 'OIbInteger',
    newRow: true,
    md: 4,
    label: 'Minimum Age',
    valid: (val) => (val > 0 ? null : 'Minimum Age should be greater than 0'),
    defaultValue: 1000,
    help: <div>Path to the error folder</div>,
  },
  regex: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'RegExp',
    valid: notEmpty(),
    defaultValue: '.txt',
    help: <div>RegExp to filter the folder</div>,
  },
}

schema.points = null

export default schema
