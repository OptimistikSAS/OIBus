import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormText, Label, Input, FormFeedback } from 'reactstrap'
import objectPath from 'object-path'
import { ConfigContext } from '../../context/configContext.jsx'

const OIbScanMode = ({ label, help, value, name, scanGroup, onChange }) => {
  const { newConfig } = React.useContext(ConfigContext)
  const scanModes = newConfig?.engine?.scanModes ?? [] // scan modes defined in engine
  let options = scanModes.map((e) => e.scanMode)
  if (options === null || options.length === 0) {
    options = [''] // empty string if no scan mode on engine
  }
  // allOptions used for validation
  const allOptions = options.slice()
  if (scanGroup) {
    // scan mode is part of a scan group and each option can be selected only once
    // remove already selected options
    const path = `${name.substr(0, name.indexOf('scanGroups'))}scanGroups`
    const existingScanGroups = objectPath.get(newConfig, path)
    existingScanGroups.forEach((selected) => {
      if (selected.scanMode !== '') {
        options = options.filter((option) => option !== selected.scanMode)
      }
    })
    // add currently selected value to available options
    options.unshift(value)
  } else if (value === '' && !options.includes('')) {
    // add empty as available option if value is empty and not exists
    options.unshift(value)
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
  if (!allOptions.includes(value)) {
    allOptions.unshift(value)
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
  scanGroup: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string,
}
OIbScanMode.defaultProps = { label: null, help: null, value: '', scanGroup: false }

export default OIbScanMode
