import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormText, Label, Input } from 'reactstrap'

const OIbSelect = ({ label, help, option, options, name, onChange }) => {
  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, null)
  }

  return (
    <FormGroup>
      {label && <Label for={name}>{label}</Label>}
      <Input className="oi-form-input" type="select" id={name} name={name} onChange={handleChange} value={option}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Input>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OIbSelect.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.element,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(String).isRequired,
  option: PropTypes.string.isRequired,
}
OIbSelect.defaultProps = { label: null, help: null }

export default OIbSelect
