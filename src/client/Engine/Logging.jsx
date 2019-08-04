import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbInteger, OIbSelect, OIbText, OIbCheckBox, OIbHelp } from '../components/OIbForm'

const Logging = ({ logParameters, onChange }) => (
  <>
    <h2>Log Parameters</h2>
    <Row>
      <Col md={2}>
        <OIbSelect
          label="Console Level"
          name="logParameters.consoleLevel"
          option={logParameters.consoleLevel}
          options={['silly', 'debug', 'info', 'warning', 'error']}
          help={<div>The level for the Console log</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={2}>
        <OIbSelect
          name="logParameters.fileLevel"
          label="File Level"
          options={['silly', 'debug', 'info', 'warning', 'error']}
          option={logParameters.fileLevel}
          help={<div>The level for the file log</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={2}>
        <OIbSelect
          label="Sqlite Level"
          name="logParameters.sqliteLevel"
          options={['silly', 'debug', 'info', 'warning', 'error']}
          option={logParameters.sqliteLevel}
          help={<div>The level for the sqlite log</div>}
          onChange={onChange}
        />
      </Col>
    </Row>
    <Row>
      <Col md={4}>
        <OIbText
          name="logParameters.filename"
          label="Filename for the log file"
          value={logParameters.filename}
          help={<div>The filename of the log file</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={4}>
        <OIbText
          name="logParameters.sqliteFilename"
          label="Filename of sqlite db"
          value={logParameters.sqliteFilename}
          help={<div>The filename of the db file</div>}
          onChange={onChange}
        />
      </Col>
    </Row>
    <Row>
      <Col md={3}>
        <OIbInteger
          name="maxsize"
          label="Max size of the journal file"
          value={logParameters.maxsize}
          help={<div>Maximum size of file logs (Bytes)</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={3}>
        <OIbInteger
          name="logParameters.sqliteMaxFileSize"
          label="Max size of sqlite db"
          value={logParameters.sqliteMaxFileSize}
          help={<div>Max File Size of the sqlite database (Byte)</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={3}>
        <OIbInteger
          name="logParameters.maxFiles"
          label="number of journal files"
          value={logParameters.maxFiles}
          min={1}
          max={10}
          help={<div>The number of journal files (rotating)</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={3}>
        <OIbCheckBox
          label="Tailable"
          name="logParameters.tailable"
          value={logParameters.tailable}
          onChange={onChange}
        />
      </Col>
    </Row>
    <OIbHelp>
      <div>Ceci est une aide qui peut être trés longue</div>
    </OIbHelp>
  </>
)

Logging.propTypes = {
  onChange: PropTypes.func.isRequired,
  logParameters: PropTypes.object.isRequired,
}
export default Logging
