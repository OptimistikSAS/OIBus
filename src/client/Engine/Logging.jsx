import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbInteger, OIbSelect, OIbText, OIbCheckBox } from '../components/OIbForm'

const Logging = ({ defaultValue, onChange }) => {
  const [currentLog, setCurrentLog] = React.useState(defaultValue)
  console.info(currentLog, setCurrentLog)

  return (
    <>
      <h2>Log Parameters</h2>
      <Row>
        <Col md={4}>
          <OIbSelect
            label="Console Level"
            defaultLevel="info"
            options={['silly', 'debug', 'info', 'warning', 'error']}
            help={<div>The level for the Console log</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={4}>
          <OIbSelect
            label="File Level"
            defaultLevel="info"
            options={['silly', 'debug', 'info', 'warning', 'error']}
            help={<div>The level for the Console log</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={4}>
          <OIbSelect
            label="Sqlite Level"
            defaultLevel="info"
            options={['silly', 'debug', 'info', 'warning', 'error']}
            help={<div>The level for the sqlite log</div>}
            onChange={onChange}
          />
        </Col>
      </Row>
      <Row>
        <Col md={6}>
          <OIbText
            label="Filename for the log"
            defaultValue="./logs/journal.log"
            help={<div>The filename of the log file</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={6}>
          <OIbText
            label="Filename for the sqlite journal"
            defaultValue="./logs/journal.db"
            help={<div>The filename of the db file</div>}
            onChange={onChange}
          />
        </Col>
      </Row>
      <Row>
        <Col md={3}>
          <OIbInteger
            label="Max Size of the journal file (Bytes)"
            defaultValue={100000}
            help={<div>The filename of the log file</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={3}>
          <OIbInteger
            label="Max File Size When To Start Deleting Old Log Records (Byte)"
            defaultValue={500000}
            help={<div>The filename of the log file</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={3}>
          <OIbInteger
            label="number of journal files"
            defaultValue={5}
            min={1}
            max={10}
            help={<div>The number of journal files (rotating)</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={3}>
          <OIbCheckBox
            label="Tailable"
            defaultValue
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
  defaultValue: PropTypes.number.isRequired,
}
export default Logging
