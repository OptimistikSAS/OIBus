import React from 'react'
import PropTypes from 'prop-types'
import OibForm from '../../components/oib-form/oib-form.jsx'
import { minValue } from '../../../service/validation.service'

const schema = { name: 'SQLiteLogging' }
schema.form = {
  level: {
    type: 'OibSelect',
    md: 3,
    options: ['trace', 'debug', 'info', 'warning', 'error', 'none'],
    defaultValue: 'info',
    help: <div>The level for the Sqlite log</div>,
  },
  maxNumberOfLogs: {
    type: 'OibInteger',
    newRow: false,
    md: 2,
    label: 'Max number of logs',
    valid: minValue(100000),
    defaultValue: 1000000,
    help: <div>Maximum number of logs in the SQLite database</div>,
  },
}

const SqliteLogging = ({ logParameters, onChange }) => (
  <div>
    <h6>SQLite</h6>
    <OibForm onChange={onChange} schema={schema} name="engine.logParameters.sqliteLog" values={logParameters} />
  </div>
)

SqliteLogging.propTypes = {
  onChange: PropTypes.func.isRequired,
  logParameters: PropTypes.object.isRequired,
}
export default SqliteLogging
