import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbText = ({ label, help, regExp, value, name, onChange }) => {
  const [currentValue, setCurrentValue] = React.useState(value)
  const isValid = (val) => (regExp ? regExp.test(val) : true)

  const handleChange = (event) => {
    const { target } = event
    setCurrentValue(value)
    if (isValid(value)) onChange(target.name, target.value)
  }

  return (
    <FormGroup>
      <Label for={name}>{label}</Label>
      <Input
        type="text"
        id={name}
        name={name}
        invalid={!isValid(currentValue)}
        onChange={handleChange}
        value={currentValue}
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
