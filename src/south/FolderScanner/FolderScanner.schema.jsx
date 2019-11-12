import React from 'react'
import { notEmpty, minValue, isBoolean } from '../../services/validation.service'

const schema = { name: 'FolderScanner' }
schema.form = {
  inputFolder: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: './input',
    help: <div>Path to the input folder</div>,
  },
  scanMode: { newRow: false, type: 'OIbScanMode', label: 'Scan Mode' },
  preserve: {
    type: 'OIbCheckBox',
    label: 'Preserve File?',
    valid: isBoolean(),
    defaultValue: true,
    help: <div>Preserve the file</div>,
  },
  minAge: {
    type: 'OIbInteger',
    label: 'Minimum Age',
    valid: minValue(0),
    defaultValue: 1000,
    help: <div>Path to the error folder</div>,
  },
  regex: {
    type: 'OIbText',
    label: 'RegExp',
    valid: notEmpty(),
    defaultValue: '.txt',
    help: <div>RegExp to filter the folder</div>,
  },
}

schema.points = null

export default schema
