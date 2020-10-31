import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormText, Label, Input, FormFeedback } from 'reactstrap'
import { ConfigContext } from '../../context/configContext.jsx'

const OIbScanMode = ({ label, help, value, name, onChange }) => {
  const { newConfig } = React.useContext(ConfigContext)
  const scanModes = newConfig?.engine?.scanModes ?? [] // scan modes defined in engine
  const options = scanModes.map((e) => e.scanMode)
  if (options === null || options.length === 0) {
    options.push(['']) // empty string if no scan mode on engine
  }
  const defaultValue = options[0]
  let validCheck = null

  React.useEffect(() => {
    if (value === '') onChange(name, defaultValue)
  }, [value])

  React.useEffect(() => {
    // save error if validCheck has error message
    onChange(name, value, validCheck)
  }, [validCheck])

  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, null)
  }

  // check if defined scanmode is unknown to the engine
  if (!options.includes(value)) {
    options.unshift(value)
    validCheck = 'Invalid scan mode'
  }

  return (
    <FormGroup>
      {label && <Label for={name}>{label}</Label>}
      <Input className="oi-form-input" type="select" id={name} name={name} invalid={validCheck !== null} onChange={handleChange} value={value}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Input>
      <FormFeedback>{validCheck}</FormFeedback>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OIbScanMode.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.element,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string,
}
OIbScanMode.defaultProps = { label: null, help: null, value: '' }

export default OIbScanMode
