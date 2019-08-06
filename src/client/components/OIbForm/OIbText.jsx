import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbText = ({ label, help, regExp, value, name, onChange }) => {
  const isValid = (val) => (regExp ? regExp.test(val) : true)

  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, isValid(newVal) ? '' : `incorrect entry for ${name}`)
  }
  // if no label, we are in a table so we need to minimize the row height
  const style = label ? null : { style: { marginBottom: 0 } }
  return (
    <FormGroup {...style}>
      {label && <Label for={name}>{label}</Label>}
      <Input className="oi-form-input" type="text" id={name} name={name} invalid={!isValid(value)} onChange={handleChange} value={value} />
      <FormFeedback>Invalid Entry</FormFeedback>
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
  regExp: PropTypes.instanceOf(RegExp),
}
OIbText.defaultProps = { regExp: null, label: null, help: null }

export default OIbText
