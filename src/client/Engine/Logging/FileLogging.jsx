import React from 'react'
import PropTypes from 'prop-types'
import OIbForm from '../../components/OIbForm/OIbForm.jsx'
import { notEmpty, minValue, inRange } from '../../../services/validation.service'

const schema = { name: 'FileLogging' }
schema.form = {
  level: {
    type: 'OIbSelect',
    options: ['silly', 'debug', 'info', 'warning', 'error', 'none'],
    md: 3,
    defaultValue: 'info',
    help: <div>The level for the file log</div>,
  },
  fileName: {
    type: 'OIbText',
    label: 'File name for the log file',
    valid: notEmpty(),
    defaultValue: '',
    md: 4,
    help: <div>The file name of the log file</div>,
  },
  maxSize: {
    type: 'OIbInteger',
    newRow: false,
    label: 'File max size',
    md: 2,
    valid: minValue(10000),
    defaultValue: 100000,
    help: <div>Maximum size of the log files (Bytes)</div>,
  },
  numberOfFiles: {
    type: 'OIbInteger',
    newRow: false,
    label: 'Number of files',
    md: 2,
    valid: inRange(1, 10),
    defaultValue: 5,
    help: <div>The number of log files (rotating)</div>,
  },
  tailable: {
    type: 'OIbCheckBox',
    newRow: false,
    md: 3,
    label: 'Tailable',
    defaultValue: true,
  },
}

const FileLogging = ({ logParameters, onChange }) => (
  <div>
    <h6>File</h6>
    <OIbForm onChange={onChange} schema={schema} name="engine.logParameters.fileLog" values={logParameters} />
  </div>
)

FileLogging.propTypes = {
  onChange: PropTypes.func.isRequired,
  logParameters: PropTypes.object.isRequired,
}
export default FileLogging
