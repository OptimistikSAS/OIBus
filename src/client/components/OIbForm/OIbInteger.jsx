import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbInteger = ({ label, help, valid, value, name, onChange }) => {
  const handleChange = (event) => {
    const { target } = event
    const { value: v } = target
    const newVal = Number.isNaN(parseInt(v, 10)) ? v : parseInt(v, 10)
    onChange(name, newVal, valid(newVal))
  }
  // if no label, we are in a table so we need to minimize the row height
  const style = label ? null : { marginBottom: 0 }
  const validCheck = valid(value)
  return (
    <FormGroup style={style}>
      {label && <Label for={name}>{label}</Label>}
      <Input className="oi-form-input" type="integer" id={name} name={name} invalid={validCheck !== null} value={value} onChange={handleChange} />
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
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  valid: PropTypes.func,
}
OIbInteger.defaultProps = {
  valid: () => null,
  label: null,
  help: null,
}

export default OIbInteger
