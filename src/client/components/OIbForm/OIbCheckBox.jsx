import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, Label, FormText, Input } from 'reactstrap'

const OIbCheckBox = ({
  label,
  help,
  value,
  name,
  onChange,
  defaultValue,
  switchButton,
}) => {
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
      <FormGroup switch>
        <Input
          className="mb-3"
          type="switch"
          id={name}
          name={name}
          label={label}
          onChange={handleChange}
          checked={value}
          color="secondary"
        />
        {help && <FormText>{help}</FormText>}
      </FormGroup>
    )
  }
  return (
    <FormGroup className="mb-3">
      <Label check>{label}</Label>
      <Input
        className="oi-form-input checkbox"
        type="checkbox"
        id={name}
        name={name}
        onChange={handleChange}
        checked={value}
      />

      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OIbCheckBox.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.element,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.bool,
  defaultValue: PropTypes.bool.isRequired,
  switchButton: PropTypes.bool,
}

OIbCheckBox.defaultProps = {
  value: null,
  help: null,
  switchButton: false,
  label: null,
}

export default OIbCheckBox
