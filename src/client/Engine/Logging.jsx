import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbInteger, OIbSelect, OIbText, OIbCheckBox, OIbTitle } from '../components/OIbForm'
import validation from './Engine.validation'

const Logging = ({ logParameters, onChange }) => (
  <>
    <OIbTitle label="Log Parameters">
      <>
        <p>OIBus can send logs to 3 different supports:</p>

        <ul>
          <li>The Console logs message on the terminal. It cannot be used when OIBus runs as a Windows service</li>
          <li>The File logs logs message on the chosen folder of the server</li>
          <ul>
            <li>filename: The filename of the logfile to write output to.</li>
            <li>
              maxsize: Max size in bytes of the logfile, if the size is exceeded then a new file is created,
              a counter will become a suffix of the log file.
            </li>
            <li>maxFiles: Limit the number of files created when the size of the logfile is exceeded.</li>
            <li>
              tailable: If true, log files will be rolled based on maxsize and maxfiles, but in ascending order. The filename will always have the
              most recent log lines. The larger the appended number, the older the log file. This option requires maxFiles to be set, or it will be
              ignored.
            </li>
          </ul>
          <li>
            The sqlite logs will be used to store logs on the chosen database of the server.
            This allows to see logs remotely using the Logs menu. The
            maximum size can be defined so older message will be deleted automatically.
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
          We recommend to use the info or warning levels in normal operations and to put the debug or the silly mode only to identify the origin of an
          issue.
        </p>
      </>
    </OIbTitle>
    <Row>
      <Col md={3}>
        <OIbSelect
          label="Console Level"
          name="engine.logParameters.consoleLevel"
          value={logParameters.consoleLevel}
          options={['silly', 'debug', 'info', 'warning', 'error']}
          defaultValue="info"
          help={<div>The level for the Console log</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={3}>
        <OIbSelect
          name="engine.logParameters.fileLevel"
          label="File Level"
          options={['silly', 'debug', 'info', 'warning', 'error']}
          defaultValue="info"
          value={logParameters.fileLevel}
          help={<div>The level for the file log</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={3}>
        <OIbSelect
          label="Sqlite Level"
          name="engine.logParameters.sqliteLevel"
          options={['silly', 'debug', 'info', 'warning', 'error']}
          defaultValue="info"
          value={logParameters.sqliteLevel}
          help={<div>The level for the sqlite log</div>}
          onChange={onChange}
        />
      </Col>
    </Row>
    <Row>
      <Col md={4}>
        <OIbText
          name="engine.logParameters.filename"
          label="Filename for the log file"
          value={logParameters.filename}
          valid={validation.engine.logParameters.filename}
          help={<div>The filename of the log file</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={2}>
        <OIbInteger
          name="engine.logParameters.maxsize"
          label="File Max size"
          value={logParameters.maxsize}
          defaultValue={100000}
          valid={validation.engine.logParameters.maxsize}
          help={<div>Maximum size of file logs (Bytes)</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={2}>
        <OIbInteger
          name="engine.logParameters.maxFiles"
          label="number of files"
          value={logParameters.maxFiles}
          defaultValue={5}
          valid={validation.engine.logParameters.maxFiles}
          help={<div>The number of journal files (rotating)</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={3}>
        <OIbCheckBox label="Tailable" name="engine.logParameters.tailable" value={logParameters.tailable} defaultValue onChange={onChange} />
      </Col>
    </Row>
    <Row>
      <Col md={4}>
        <OIbText
          name="engine.logParameters.sqliteFilename"
          label="Filename of sqlite db"
          value={logParameters.sqliteFilename}
          valid={validation.engine.logParameters.sqliteFilename}
          help={<div>The filename of the db file</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={2}>
        <OIbInteger
          name="engine.logParameters.sqliteMaxFileSize"
          label="Db Max size"
          value={logParameters.sqliteMaxFileSize}
          defaultValue={1000000}
          valid={validation.engine.logParameters.sqliteMaxFileSize}
          help={<div>Max File Size of the sqlite database (Byte)</div>}
          onChange={onChange}
        />
      </Col>
    </Row>
  </>
)

Logging.propTypes = {
  onChange: PropTypes.func.isRequired,
  logParameters: PropTypes.object.isRequired,
}
export default Logging
