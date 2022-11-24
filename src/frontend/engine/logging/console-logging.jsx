import React from 'react'
import PropTypes from 'prop-types'
import OibForm from '../../components/oib-form/oib-form.jsx'

const schema = { name: 'ConsoleLogging' }
schema.form = {
  level: {
    type: 'OibSelect',
    options: ['trace', 'debug', 'info', 'warning', 'error', 'silent'],
    md: 3,
    defaultValue: 'info',
    help: <div>The level for the Console log</div>,
  },
}

const ConsoleLogging = ({ logParameters, onChange }) => (
  <div>
    <h6>Console</h6>
    <OibForm onChange={onChange} schema={schema} name="engine.logParameters.consoleLog" values={logParameters} />
  </div>
)

ConsoleLogging.propTypes = {
  onChange: PropTypes.func.isRequired,
  logParameters: PropTypes.object.isRequired,
}
export default ConsoleLogging
