import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbText = ({ label, help, valid, value, name, onChange }) => {
  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, valid(newVal))
  }
  // if no label, we are in a table so we need to minimize the row height
  const style = label ? null : { style: { marginBottom: 0 } }
  const validCheck = valid(value)
  return (
    <FormGroup {...style}>
      {label && <Label for={name}>{label}</Label>}
      <Input className="oi-form-input" type="text" id={name} name={name} invalid={validCheck !== null} onChange={handleChange} value={value} />
      <FormFeedback>{validCheck}</FormFeedback>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OIbText.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.element,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
  valid: PropTypes.func,
}
OIbText.defaultProps = { valid: () => null, label: null, help: null }

export default OIbText
