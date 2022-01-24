import React from 'react'
import PropTypes from 'prop-types'
import OIbForm from '../../components/OIbForm/OIbForm.jsx'
import { minValue, optional } from '../../../services/validation.service'

const schema = { name: 'LokiLogging' }
schema.form = {
  level: {
    type: 'OIbSelect',
    md: 3,
    options: ['trace', 'debug', 'info', 'warning', 'error', 'none'],
    defaultValue: 'info',
    help: <div>The level for the Loki log</div>,
  },
  lokiAddress: {
    type: 'OIbText',
    label: 'Host',
    md: 4,
    valid: optional(),
    defaultValue: '',
    help: <div>The host name of the Loki instance</div>,
  },
  interval: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: minValue(10),
    defaultValue: 60,
    help: <div>Interval between batch of logs (in s)</div>,
  },
  tokenAddress: {
    type: 'OIbText',
    label: 'Token address',
    md: 4,
    valid: optional(),
    defaultValue: '',
    help: <div>The address of the token provider (need username and password)</div>,
  },
  username: {
    type: 'OIbText',
    defaultValue: '',
    valid: optional(),
    md: 3,
  },
  password: {
    newRow: false,
    type: 'OIbPassword',
    defaultValue: '',
    valid: optional(),
    md: 3,
  },
}

const LokiLogging = ({ logParameters, onChange }) => (
  <div>
    <h6>Loki</h6>
    <OIbForm onChange={onChange} schema={schema} name="engine.logParameters.lokiLog" values={logParameters} />
  </div>
)

LokiLogging.propTypes = {
  onChange: PropTypes.func.isRequired,
  logParameters: PropTypes.object.isRequired,
}
export default LokiLogging
