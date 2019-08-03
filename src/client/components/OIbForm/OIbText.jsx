import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbText = ({ label, help, regExp, value, id, onChange }) => {
  const [currentValue, setCurrentValue] = React.useState(value)
  const isValid = (val) => (regExp ? regExp.test(val) : null)

  const handleChange = (event) => {
    const { target } = event
    setCurrentValue(value)
    if (isValid(value)) onChange(target.name, target.value)
  }

  return (
    <FormGroup>
      <Label for={id}>{label}</Label>
      <Input
        type="text"
        id={id}
        name={id}
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
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.element.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
  regExp: PropTypes.instanceOf(RegExp),
}
OIbText.defaultProps = { regExp: null }


export default OIbText
