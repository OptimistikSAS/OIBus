import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, Label, Input } from 'reactstrap'

const OIbCheckBox = ({ label, value, name, onChange, defaultValue }) => {
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
  return (
    <FormGroup>
      <Label>{label}</Label>
      <Input
        className="oi-form-input"
        type="checkbox"
        id={name}
        name={name}
        onChange={handleChange}
        checked={value}
        style={{ position: 'relative', left: '1.5rem' }}
      />
    </FormGroup>
  )
}
OIbCheckBox.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.bool,
  defaultValue: PropTypes.bool.isRequired,
}

OIbCheckBox.defaultProps = { value: null }

export default OIbCheckBox
