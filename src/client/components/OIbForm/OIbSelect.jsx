import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbSelect = ({ label, help, regExp, defaultValue, id, onChange }) => {
  const [currentValue, setCurrentValue] = React.useState(defaultValue)
  const isValid = (value) => (regExp ? true : regExp.test(value))

  const handleChange = (event) => {
    const { target } = event
    const { value, name } = target
    setCurrentValue(value)
    if (isValid(value)) onChange(name, value)
  }

  return (
    <FormGroup>
      <Label for={id}>{label}</Label>
      <Input
        type="text"
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
OIbSelect.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  defaultValue: PropTypes.number.isRequired,
  regExp: PropTypes.instanceOf(RegExp),
}
OIbSelect.defaultProps = { regExp: null }


export default OIbSelect
