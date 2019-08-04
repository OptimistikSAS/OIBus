import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbText = ({ label, help, regExp, value, name, onChange }) => {
  const isValid = (val) => (regExp ? regExp.test(val) : true)

  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal)
  }

  return (
    <FormGroup>
      <Label for={name}>{label}</Label>
      <Input
        type="text"
        id={name}
        name={name}
        invalid={!isValid(value)}
        onChange={handleChange}
        value={value}
      />
      <FormFeedback>Invalid Entry</FormFeedback>
      <FormText>{help}</FormText>
    </FormGroup>
  )
}
OIbText.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.element.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
  regExp: PropTypes.instanceOf(RegExp),
}
OIbText.defaultProps = { regExp: null }


export default OIbText
