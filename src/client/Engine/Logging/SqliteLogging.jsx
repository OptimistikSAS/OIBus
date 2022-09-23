import React from 'react'
import PropTypes from 'prop-types'
import OIbForm from '../../components/OIbForm/OIbForm.jsx'
import { minValue } from '../../../services/validation.service'

const schema = { name: 'SQLiteLogging' }
schema.form = {
  level: {
    type: 'OIbSelect',
    md: 3,
    options: ['trace', 'debug', 'info', 'warning', 'error', 'none'],
    defaultValue: 'info',
    help: <div>The level for the Sqlite log</div>,
  },
  maxNumberOfLogs: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    label: 'Database max size',
    valid: minValue(10000),
    defaultValue: 1000000,
    help: <div>Max size of the sqlite database (Byte)</div>,
  },
}

const SqliteLogging = ({ logParameters, onChange }) => (
  <div>
    <h6>SQLite</h6>
    <OIbForm onChange={onChange} schema={schema} name="engine.logParameters.sqliteLog" values={logParameters} />
  </div>
)

SqliteLogging.propTypes = {
  onChange: PropTypes.func.isRequired,
  logParameters: PropTypes.object.isRequired,
}
export default SqliteLogging
