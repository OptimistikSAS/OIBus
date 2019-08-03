import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbPassword = ({ label, help, defaultValue, id, onChange }) => {
  const [currentValue, setCurrentValue] = React.useState(defaultValue)
  /** @todo:  ask for a second password */
  // const isValid = (value) => (regExp ? true : regExp.test(value))

  const handleChange = (event) => {
    const { target } = event
    const { value, name } = target
    setCurrentValue(value)
    /* if (isValid(value)) */ onChange(name, value)
  }

  return (
    <FormGroup>
      <Label for={id}>{label}</Label>
      <Input
        type="password"
        id={id}
        name={id}
        // invalid={!isValid(currentValue)}
        defaultValue={defaultValue}
        onChange={handleChange}
        value={currentValue}
      />
      <FormFeedback>Invalid Entry</FormFeedback>
      <FormText>{help}</FormText>
    </FormGroup>
  )
}
OIbPassword.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  defaultValue: PropTypes.number.isRequired,
}


export default OIbPassword
