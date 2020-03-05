import React from 'react'
import PropTypes from 'prop-types'
import OIbForm from '../components/OIbForm/OIbForm.jsx'

import { notEmpty } from '../../services/validation.service'

const schema = { name: 'Logging' }
schema.form = {
  LoggingParameters: {
    type: 'OIbTitle',
    children: (
      <>
        <p>OIBus can send logs to 3 different supports:</p>

        <ul>
          <li>The Console logs message on the terminal. It cannot be used when OIBus runs as a Windows service</li>
          <li>The File logs logs message on the chosen folder of the server</li>
          <ul>
            <li>filename: The filename of the logfile to write output to.</li>
            <li>
              maxsize: Max size in bytes of the logfile, if the size is exceeded then a new file is created, a counter
              will become a suffix of the log file.
            </li>
            <li>maxFiles: Limit the number of files created when the size of the logfile is exceeded.</li>
            <li>
              tailable: If true, log files will be rolled based on maxsize and maxfiles, but in ascending order. The
              filename will always have the most recent log lines. The larger the appended number, the older the log
              file. This option requires maxFiles to be set, or it will be ignored.
            </li>
          </ul>
          <li>
            The sqlite logs will be used to store logs on the chosen database of the server. This allows to see logs
            remotely using the Logs menu. The maximum size can be defined so older message will be deleted
            automatically.
          </li>
        </ul>

        <table>
          <thead>
            <tr>
              <th>Possible levels</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Error</td>
              <td>these logs needs investigation in a production system</td>
            </tr>
            <tr>
              <td>Warning</td>
              <td>unexpected behavior that will not impact significantly the system</td>
            </tr>
            <tr>
              <td>Info</td>
              <td>information useful to the administrator</td>
            </tr>
            <tr>
              <td>Debug</td>
              <td>informations useful only to debug an issue</td>
            </tr>
            <tr>
              <td>Silly</td>
              <td>informations useful to debug an issue but they will significantly impact performances</td>
            </tr>
          </tbody>
        </table>
        <br />
        <p>
          We recommend to use the info or warning levels in normal operations and to put the debug or the silly mode
          only to identify the origin of an issue.
        </p>
      </>
    ),
  },
  consoleLevel: {
    type: 'OIbSelect',
    options: ['silly', 'debug', 'info', 'warning', 'error'],
    md: 3,
    defaultValue: 'info',
    help: <div>The level for the Console log</div>,
  },
  fileLevel: {
    type: 'OIbSelect',
    newRow: false,
    options: ['silly', 'debug', 'info', 'warning', 'error'],
    md: 3,
    defaultValue: 'info',
    help: <div>The level for the file log</div>,
  },
  sqliteLevel: {
    newRow: false,
    type: 'OIbSelect',
    md: 3,
    options: ['silly', 'debug', 'info', 'warning', 'error'],
    defaultValue: 'info',
    help: <div>The level for the sqlite log</div>,
  },
  filename: {
    type: 'OIbText',
    label: 'Filename for the log file',
    valid: notEmpty(),
    defaultValue: '',
    md: 4,
    help: <div>The filename of the log file</div>,
  },
  maxsize: {
    type: 'OIbInteger',
    newRow: false,
    label: 'File Max size',
    md: 2,
    valid: notEmpty(),
    defaultValue: 100000,
    help: <div>Maximum size of file logs (Bytes)</div>,
  },
  maxFiles: {
    type: 'OIbInteger',
    newRow: false,
    label: 'number of files',
    md: 2,
    valid: notEmpty(),
    defaultValue: 5,
    help: <div>The number of journal files (rotating)</div>,
  },
  tailable: {
    type: 'OIbCheckBox',
    newRow: false,
    md: 3,
    label: 'Tailable',
    defaultValue: true,
    help: <div>The number of journal files (rotating)</div>,
  },
  sqliteFilename: {
    type: 'OIbText',
    label: 'Filename of sqlite db',
    md: 4,
    valid: notEmpty(),
    defaultValue: '',
    help: <div>The filename of the db file</div>,
  },
  sqliteMaxFileSize: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    label: 'Db Max size',
    valid: notEmpty(),
    defaultValue: 1000000,
    help: <div>Max File Size of the sqlite database (Byte)</div>,
  },
}

const Logging = ({ logParameters, onChange }) => (
  <OIbForm onChange={onChange} schema={schema} name="engine.logParameters" values={logParameters} />
)

Logging.propTypes = {
  onChange: PropTypes.func.isRequired,
  logParameters: PropTypes.object.isRequired,
}
export default Logging
