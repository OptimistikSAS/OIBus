import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormText, Label, Input } from 'reactstrap'

const OIbCheckBox = ({ label, help, value, id, onChange }) => {
  const [currentValue, setCurrentValue] = React.useState(value)

  const handleChange = (event) => {
    const { target } = event
    const { checked, name } = target
    setCurrentValue(checked)
    onChange(name, checked)
  }

  return (
    <FormGroup>
      <Label for={id}>{label}</Label>
      <Input
        type="checkbox"
        id={id}
        name={id}
        onChange={handleChange}
        value={currentValue}
      />
      <FormText>{help}</FormText>
    </FormGroup>
  )
}
OIbCheckBox.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.element.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.bool.isRequired,
}

export default OIbCheckBox
