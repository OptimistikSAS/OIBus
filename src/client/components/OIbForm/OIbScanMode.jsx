import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormText, Label, Input, FormFeedback } from 'reactstrap'
import { ConfigContext } from '../../context/configContext.jsx'

const OIbScanMode = ({ label, help, scanMode, name, onChange }) => {
  const { newConfig } = React.useContext(ConfigContext)
  const { scanModes } = newConfig.engine // scan modes defined in engine
  let options = scanModes.map((e) => e.scanMode)
  if (options === null || options.length === 0) {
    options = [''] // allow an empty string if no scan mode on engine
  }
  const defaultOption = options[0]
  let validCheck = null

  React.useEffect(() => {
    if (scanMode === null) onChange(name, defaultOption)
  }, [scanMode])

  React.useEffect(() => {
    // save error if validCheck has error message
    onChange(name, scanMode, validCheck)
  }, [validCheck])

  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, null)
  }
  // if value is null, no need to render
  if (scanMode === null) return null

  // check if defined scanmode is unknown to the engine
  if (!options.includes(scanMode)) {
    options.unshift(scanMode)
    validCheck = 'Invalid scan mode'
  }

  return (
    <FormGroup>
      {label && <Label for={name}>{label}</Label>}
      <Input className="oi-form-input" type="select" id={name} name={name} invalid={validCheck !== null} onChange={handleChange} value={scanMode}>
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
  scanMode: PropTypes.string,
}
OIbScanMode.defaultProps = { label: null, help: null, scanMode: null }

export default OIbScanMode
