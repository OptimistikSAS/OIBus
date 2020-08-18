import React from 'react'
import { notEmpty, minValue } from '../../services/validation.service'

const schema = { name: 'FolderScanner' }
schema.form = {
  FolderScannerSettings: {
    type: 'OIbTitle',
    label: 'FolderScanner settings',
    md: 12,
    children: (
      <>
        <p>
          The FolderScanner South periodically checks the input folder for new files at an interval specified by scan mode.
          When a new file is detected it will be sent to any North capable of handling files and configured to accept files from this South.
        </p>
        <p>
          It is possible to specify how to handle files.
        </p>
        <ul>
          <li>
            If Preserve File is checked the files will be left intact, otherwise they will be deleted from the input folder.
          </li>
          <li>
            The Minimum Age option is used to specify the time since the file was last modified.
            It is used to prevent handling files that are still populated.
          </li>
          <li>
            The RegExp option can be used to filter what kind of files to be handled.
          </li>
        </ul>
      </>
    ),
  },
  inputFolder: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: './input',
    help: <div>Path to the input folder</div>,
  },
  preserve: {
    type: 'OIbCheckBox',
    label: 'Preserve File?',
    defaultValue: true,
  },
  minAge: {
    type: 'OIbInteger',
    label: 'Minimum Age',
    valid: minValue(0),
    defaultValue: 1000,
  },
  regex: {
    type: 'OIbText',
    label: 'RegExp',
    valid: notEmpty(),
    defaultValue: '.txt',
    help: <div>RegExp to filter the folder</div>,
  },
  compression: {
    type: 'OIbCheckBox',
    label: 'Compress File?',
    defaultValue: false,
  },
}

schema.points = null

export default schema
