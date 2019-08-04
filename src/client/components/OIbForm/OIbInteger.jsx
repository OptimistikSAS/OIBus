import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbInteger = ({ label, help, min, max, value, name, onChange }) => {
  const isValid = (val) => ((max ? val <= max : true) && ((min ? val >= min : true)))
  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, isValid(newVal) ? parseInt(newVal, 10) : newVal, isValid(newVal) ? `incorrect entry for ${name}` : '')
  }

  return (
    <FormGroup>
      <Label for={name}>{label}</Label>
      <Input
        type="integer"
        min={min}
        max={max}
        id={name}
        name={name}
        invalid={!isValid(value)}
        value={value}
        onChange={handleChange}
      />
      <FormFeedback>Invalid Entry</FormFeedback>
      <FormText>{help}</FormText>
    </FormGroup>
  )
}
OIbInteger.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.element.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  min: PropTypes.number,
  max: PropTypes.number,
}
OIbInteger.defaultProps = {
  min: null,
  max: null,
}


export default OIbInteger
