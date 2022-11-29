import React from 'react'
import PropTypes from 'prop-types'
import OibForm from '../../components/oib-form/oib-form.jsx'
import { minValue, inRange } from '../../../service/validation.service.js'

const schema = { name: 'FileLogging' }
schema.form = {
  level: {
    type: 'OibSelect',
    options: ['trace', 'debug', 'info', 'warning', 'error', 'silent'],
    md: 3,
    defaultValue: 'info',
    help: <div>The level for the File log</div>,
  },
  maxSize: {
    type: 'OibInteger',
    newRow: false,
    label: 'Max file size',
    md: 2,
    valid: minValue(1),
    defaultValue: 1,
    help: <div>Maximum size of the log files (MB)</div>,
  },
  numberOfFiles: {
    type: 'OibInteger',
    newRow: false,
    label: 'Number of files',
    md: 2,
    valid: inRange(1, 10),
    defaultValue: 5,
    help: <div>The number of log files (rotating)</div>,
  },
}

const FileLogging = ({ logParameters, onChange }) => (
  <div>
    <h6>File</h6>
    <OibForm onChange={onChange} schema={schema} name="engine.logParameters.fileLog" values={logParameters} />
  </div>
)

FileLogging.propTypes = {
  onChange: PropTypes.func.isRequired,
  logParameters: PropTypes.object.isRequired,
}
export default FileLogging
