import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbSelect = ({ label, help, valid, option, options, name, onChange, defaultOption }) => {
  React.useEffect(() => {
    if (option === null) onChange(name, defaultOption)
  }, [option])

  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, null, valid(newVal))
  }

  const validCheck = valid(option)
  // if value is null, no need to render
  if (option === null) return null
  return (
    <FormGroup>
      {label && <Label for={name}>{label}</Label>}
      <Input className="oi-form-input" type="select" id={name} name={name} onChange={handleChange} value={option} invalid={validCheck !== null}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Input>
      <FormFeedback>{validCheck}</FormFeedback>
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
  option: PropTypes.string,
  defaultOption: PropTypes.string.isRequired,
  valid: PropTypes.func,
}
OIbSelect.defaultProps = { label: null, help: null, option: null, valid: () => null }

export default OIbSelect
