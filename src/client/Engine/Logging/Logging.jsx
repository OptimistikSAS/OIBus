import React from 'react'
import PropTypes from 'prop-types'
import OIbTitle from '../../components/OIbForm/OIbTitle.jsx'

import ConsoleLogging from './ConsoleLogging.jsx'
import FileLogging from './FileLogging.jsx'
import SqliteLogging from './SqliteLogging.jsx'
import LokiLogging from './LokiLogging.jsx'

const Logging = ({ logParameters, onChange }) => (
  <div>
    <OIbTitle label="Logging parameters">
      <>
        <p>OIBus can send logs to 4 different supports:</p>

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
          <li>
            The loki logs send the logs to a loki instance. This allows to access the logs remotely.
          </li>
        </ul>

        <table>
          <thead>
            <tr>
              <th>Levels</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Error</td>
              <td>These logs needs investigation in a production system</td>
            </tr>
            <tr>
              <td>Warning</td>
              <td>Unexpected behavior that will not impact significantly the system</td>
            </tr>
            <tr>
              <td>Info</td>
              <td>Information useful to the administrator</td>
            </tr>
            <tr>
              <td>Debug</td>
              <td>Information useful only to debug an issue</td>
            </tr>
            <tr>
              <td>Silly</td>
              <td>Information useful to debug an issue but they will significantly impact performances</td>
            </tr>
            <tr>
              <td>None</td>
              <td>This logging is not activated</td>
            </tr>
          </tbody>
        </table>
        <br />
        <p>
          We recommend to use the info or warning levels in normal operations and to put the debug or the silly mode
          only to identify the origin of an issue.
        </p>
      </>
    </OIbTitle>
    <ConsoleLogging logParameters={logParameters.consoleLog} onChange={onChange} />
    <FileLogging logParameters={logParameters.fileLog} onChange={onChange} />
    <SqliteLogging logParameters={logParameters.sqliteLog} onChange={onChange} />
    <LokiLogging logParameters={logParameters.lokiLog} onChange={onChange} />
  </div>
)

Logging.propTypes = {
  onChange: PropTypes.func.isRequired,
  logParameters: PropTypes.object.isRequired,
}
export default Logging
