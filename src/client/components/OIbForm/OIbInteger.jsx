import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbInteger = ({ label, help, min, max, defaultValue, id, onChange }) => {
  const [currentValue, setCurrentValue] = React.useState(defaultValue)
  const isValid = (value) => (value <= max && value >= min)

  const handleChange = (event) => {
    const { target } = event
    const { value, name } = target
    console.info('set json avec la nouvelle valeur', name, value)
    setCurrentValue(value)
    if (isValid(value)) onChange(value)
  }

  return (
    <FormGroup>
      <Label for={id}>{label}</Label>
      <Input
        type="integer"
        min={min}
        max={max}
        id={id}
        name={id}
        invalid={!isValid(currentValue)}
        defaultValue={defaultValue}
        onChange={handleChange}
        value={currentValue}
      />
      <FormFeedback>Invalid Entry</FormFeedback>
      <FormText>{help}</FormText>
    </FormGroup>
  )
}
OIbInteger.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  defaultValue: PropTypes.number.isRequired,
  min: PropTypes.number,
  max: PropTypes.number,
}
OIbInteger.defaultProps = {
  min: null,
  max: null,
}


export default OIbInteger
