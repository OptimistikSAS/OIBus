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
  logOptions: ['engine', 'trace', 'debug', 'info', 'warning', 'error', 'none'],
  help: (
    <>
      <p>OIBus can send logs to 4 different supports:</p>

      <ul>
        <li>The Console logs messages on the terminal. It cannot be used when OIBus runs as a Windows service</li>
        <li>The File logs writes messages on the chosen folder of the OIBus machine</li>
        <li>
          The Sqlite logs will be used to store logs on the chosen database of the OIBus machine. This allows to see logs
          using the Logs menu. The maximum size can be defined so older message will be deleted automatically.
        </li>
        <li>
          The Loki logs send the logs to a loki instance. This allows to access the logs remotely.
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
            <td>Use global log level selected on engine</td>
          </tr>
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
            <td>Trace</td>
            <td>Information useful to debug an issue but they will significantly impact performances</td>
          </tr>
        </tbody>
      </table>
      <br />
      <p>
        We recommend to use the info or warning levels in normal operations and to put the debug or the trace mode
        only to identify the origin of an issue.
      </p>
    </>
  ),
}

export default OIbLogLevel
