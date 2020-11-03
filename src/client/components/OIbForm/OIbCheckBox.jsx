import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, Label, Input, CustomInput } from 'reactstrap'

const OIbCheckBox = ({ label, value, name, onChange, defaultValue, switchButton }) => {
  // if no value was found, load the context with the default value
  // (this will cause a rerender with the correct value)
  React.useLayoutEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])
  const handleChange = (event) => {
    const { target } = event
    const { checked } = target
    onChange(name, checked, null)
  }
  if (value === null) return null
  if (switchButton) {
    return (
      <FormGroup>
        <CustomInput
          type="switch"
          id={name}
          name={name}
          label={label}
          onChange={handleChange}
          checked={value}
          color="secondary"
        />
      </FormGroup>
    )
  }
  return (
    <FormGroup check>
      <Label check>
        {label}
        <Input
          className="oi-form-input checkbox"
          type="checkbox"
          id={name}
          name={name}
          onChange={handleChange}
          checked={value}
        />
      </Label>
    </FormGroup>
  )
}
OIbCheckBox.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.bool,
  defaultValue: PropTypes.bool.isRequired,
  switchButton: PropTypes.bool,
}

OIbCheckBox.defaultProps = { value: null, switchButton: false }

export default OIbCheckBox
