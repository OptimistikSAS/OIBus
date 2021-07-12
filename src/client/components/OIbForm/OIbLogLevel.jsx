import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import OIbTitle from './OIbTitle.jsx'
import OIbSelect from './OIbSelect.jsx'

const OIbLogLevel = ({ name, value, onChange, logOptions, help }) => (
  <>
    <OIbTitle label="Logging parameters">
      {help}
    </OIbTitle>
    <Row>
      <Col md="2">
        <OIbSelect
          label="Console level"
          onChange={onChange}
          value={value.consoleLevel}
          options={logOptions}
          defaultValue="engine"
          name={`${name}.consoleLevel`}
        />
      </Col>
      <Col md="2">
        <OIbSelect
          label="File level"
          onChange={onChange}
          value={value.fileLevel}
          options={logOptions}
          defaultValue="engine"
          name={`${name}.fileLevel`}
        />
      </Col>
      <Col md="2">
        <OIbSelect
          label="Sqlite level"
          onChange={onChange}
          value={value.sqliteLevel}
          options={logOptions}
          defaultValue="engine"
          name={`${name}.sqliteLevel`}
        />
      </Col>
      <Col md="2">
        <OIbSelect
          label="Loki level"
          onChange={onChange}
          value={value.lokiLevel}
          options={logOptions}
          defaultValue="engine"
          name={`${name}.lokiLevel`}
        />
      </Col>
    </Row>
  </>
)

OIbLogLevel.propTypes = {
  name: PropTypes.string.isRequired,
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  logOptions: PropTypes.arrayOf(String),
  help: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
}
OIbLogLevel.defaultProps = {
  value: {
    consoleLevel: 'engine',
    fileLevel: 'engine',
    sqliteLevel: 'engine',
  },
  logOptions: ['engine', 'debug', 'info', 'warning', 'error', 'silly'],
  help: (
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
            <td>Engine</td>
            <td>will use global log level selected on engine</td>
          </tr>
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
}

export default OIbLogLevel
