import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbSelect = ({ label, help, valid, value, options, optionsLabel, name, onChange, defaultValue, style }) => {
  React.useEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])

  const handleChange = (event) => {
    const { target } = event
    const { selectedIndex } = target
    // using selectedIndex from option to mantain type of option
    // otherwise target.value is always string
    const newVal = options[selectedIndex]
    onChange(name, newVal, null, valid(newVal))
  }

  const validCheck = valid(value)
  // if value is null, no need to render
  if (value === null) return null
  return (
    <FormGroup style={style}>
      {label && <Label for={name}>{label}</Label>}
      <Input
        className="oi-form-input"
        style={style}
        type="select"
        id={name}
        name={name}
        onChange={handleChange}
        value={value}
        invalid={validCheck !== null}
      >
        {options.map((o, index) => (
          <option key={o} value={o}>
            {optionsLabel[index] || o}
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
  options: PropTypes.oneOfType([
    PropTypes.arrayOf(String),
    PropTypes.arrayOf(Number),
  ]).isRequired,
  optionsLabel: PropTypes.arrayOf(String),
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  defaultValue: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]).isRequired,
  valid: PropTypes.func,
  style: PropTypes.object,
}
OIbSelect.defaultProps = { label: null, help: null, value: null, valid: () => null, style: {}, optionsLabel: [] }

export default OIbSelect
