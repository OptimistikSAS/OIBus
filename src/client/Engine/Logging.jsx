import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbInteger, OIbSelect, OIbText, OIbCheckBox } from '../components/OIbForm'

const Logging = ({ logParameters, onChange }) => {
  // eslint-disable-next-line no-unused-vars
  const [currentLog, setCurrentLog] = React.useState(logParameters)
  console.info(currentLog)

  return (
    <>
      <h2>Log Parameters</h2>
      <Row>
        <Col md={4}>
          <OIbSelect
            label="Console Level"
            id="consoleLevel"
            option="info"
            options={['silly', 'debug', 'info', 'warning', 'error']}
            help={<div>The level for the Console log</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={4}>
          <OIbSelect
            id="fileLevel"
            label="File Level"
            options={['silly', 'debug', 'info', 'warning', 'error']}
            option="info"
            help={<div>The level for the file log</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={4}>
          <OIbSelect
            label="Sqlite Level"
            id="sqlLevel"
            options={['silly', 'debug', 'info', 'warning', 'error']}
            option="info"
            help={<div>The level for the sqlite log</div>}
            onChange={onChange}
          />
        </Col>
      </Row>
      <Row>
        <Col md={6}>
          <OIbText
            id=""
            label="Filename for the log"
            value="./logs/journal.log"
            help={<div>The filename of the log file</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={6}>
          <OIbText
            id="sqlitename"
            label="Filename for the sqlite journal"
            value="./logs/journal.db"
            help={<div>The filename of the db file</div>}
            onChange={onChange}
          />
        </Col>
      </Row>
      <Row>
        <Col md={3}>
          <OIbInteger
            id="maxsize"
            label="Max Size of the journal file (Bytes)"
            value={100000}
            help={<div>The filename of the log file</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={3}>
          <OIbInteger
            id="maxold"
            label="Max File Size When To Start Deleting Old Log Records (Byte)"
            value={500000}
            help={<div>The filename of the log file</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={3}>
          <OIbInteger
            id="max"
            label="number of journal files"
            value={5}
            min={1}
            max={10}
            help={<div>The number of journal files (rotating)</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={3}>
          <OIbCheckBox
            label="Tailable"
            id="tailable"
            value={false}
            help={(
              <div>
                If true, log files will be rolled based on maxsize and maxfiles, but in ascending order. The filename
                will always have the most recent log lines. The larger the appended number, the older the log file. This
                option requires maxFiles to be set, or it will be ignored.
              </div>
            )}
            onChange={onChange}
          />
        </Col>
      </Row>
    </>
  )
}

Logging.propTypes = {
  onChange: PropTypes.func.isRequired,
  logParameters: PropTypes.object.isRequired,
}
export default Logging
