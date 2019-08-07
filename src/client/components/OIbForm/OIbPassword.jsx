import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbPassword = ({ label, help, value, name, onChange, regExp }) => {
  const isValid = (val) => (regExp ? true : regExp.test(val))
  /** @todo:  ask for a second password? */

  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal)
  }

  return (
    <FormGroup>
      {label && <Label for={name}>{label}</Label>}
      <Input className="oi-form-input" type="password" id={name} name={name} invalid={!isValid(value)} onChange={handleChange} value={value} />
      <FormFeedback>Invalid Entry</FormFeedback>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OIbPassword.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.element,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
  regExp: PropTypes.instanceOf(RegExp),
}

OIbPassword.defaultProps = { regExp: null, label: null, help: null }

export default OIbPassword
