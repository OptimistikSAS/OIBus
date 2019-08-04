import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, Label, Input } from 'reactstrap'

const OIbCheckBox = ({ label, value, name, onChange }) => {
  const [currentValue, setCurrentValue] = React.useState(value)

  const handleChange = (event) => {
    const { target } = event
    const { checked } = target
    setCurrentValue(checked)
    onChange(name, checked)
  }

  return (
    <FormGroup>
      <Label>
        {label}
      </Label>
      <Input type="checkbox" id={name} name={name} onChange={handleChange} value={currentValue} style={{ position: 'relative', top: '1.5rem' }} />
    </FormGroup>
  )
}
OIbCheckBox.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.bool.isRequired,
}

export default OIbCheckBox
