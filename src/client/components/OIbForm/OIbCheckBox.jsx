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
  checkBox,
}) => {
  // if no value was found, load the context with the default value
  // (this will cause a rerender with the correct value)
  React.useLayoutEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])
  const handleChange = (event) => {
    const { checked } = event.target
    onChange(name, checked, null)
  }
  if (value === null) return null
  return (
    <FormGroup switch={!checkBox} className="mb-3">
      <Label check>{label}</Label>
      <Input
        className="oi-form-input checkbox"
        type={checkBox ? 'checkbox' : 'switch'}
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
  checkBox: PropTypes.bool,
}

OIbCheckBox.defaultProps = {
  value: null,
  help: null,
  checkBox: false,
  label: null,
}

export default OIbCheckBox
