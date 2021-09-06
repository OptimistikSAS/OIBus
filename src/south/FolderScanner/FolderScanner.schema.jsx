import React from 'react'
import FolderScanner from './file-out.png'
import { notEmpty, minValue, endsWith } from '../../services/validation.service'

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
          Please use always the / separator. OIBus will convert it according to the platform.
          For example, on Windows, c:/input/ will be converted to c:\input\
          Make sure OIBus has READ and WRITE access to this folder.
          <b>
            When OIBus is started as a Windows service,
            you may have to assign a user logon in the Windows services.msc console.
          </b>
        </p>
        <p>
          It is possible to specify how to handle files.
        </p>
        <ul>
          <li>
            If Preserve File is checked the files will be left intact, otherwise they will be removed from the input folder.
          </li>
          <li>
            If Ignore Modified Date is checked the last edited time of the file will be ignored when the file is preserved.
            This implies that a file will be sent at each scan of the folder
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
    valid: endsWith('/'),
    defaultValue: './input/',
    help: <div>Path to folder such as: c:/input/</div>,
  },
  preserveFiles: {
    type: 'OIbCheckBox',
    label: 'Preserve File?',
    defaultValue: true,
  },
  ignoreModifiedDate: {
    type: 'OIbCheckBox',
    label: 'Ignore modified date',
    defaultValue: false,
    newRow: false,
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

schema.image = FolderScanner
export default schema
