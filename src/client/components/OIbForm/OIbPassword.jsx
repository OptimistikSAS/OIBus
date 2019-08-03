import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbPassword = ({ label, help, value, id, onChange }) => {
  const [currentValue, setCurrentValue] = React.useState(value)
  /** @todo:  ask for a second password */
  // const isValid = (value) => (regExp ? true : regExp.test(value))

  const handleChange = (event) => {
    const { target } = event
    setCurrentValue(value)
    /* if (isValid(value)) */ onChange(target.ame, target.value)
  }

  return (
    <FormGroup>
      <Label for={id}>{label}</Label>
      <Input
        type="password"
        id={id}
        name={id}
        // invalid={!isValid(currentValue)}
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
  help: PropTypes.element.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
}


export default OIbPassword
