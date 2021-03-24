import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbInteger = ({ label, help, valid, value, name, onChange, defaultValue, hidden }) => {
  // if no value was found, load the context with the default value
  // (this will cause a rerender with the correct value)
  React.useLayoutEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])
  const handleChange = (event) => {
    const { target } = event
    const { value: v } = target
    const newVal = Number.isNaN(parseInt(v, 10)) ? v : parseInt(v, 10)
    onChange(name, newVal, valid(newVal))
  }
  // if no label, we need to minimize the row height
  const style = label ? null : { marginBottom: 0 }
  if (hidden) return null
  const validCheck = valid(value)
  return (
    <FormGroup style={style}>
      {label && <Label for={name}>{label}</Label>}
      <Input
        className="oi-form-input"
        type="integer"
        id={name}
        name={name}
        invalid={validCheck !== null}
        value={value || ''}
        onChange={handleChange}
      />
      <FormFeedback>{validCheck}</FormFeedback>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OIbInteger.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.element,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  defaultValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  valid: PropTypes.func,
  hidden: PropTypes.bool,
}
OIbInteger.defaultProps = {
  valid: () => null,
  label: null,
  help: null,
  value: null,
  hidden: false,
}

export default OIbInteger
