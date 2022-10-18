import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OibText = ({ label, help, valid, value, name, onChange, defaultValue, inline, disabled, hidden }) => {
  React.useEffect(() => {
    if (value === null || value === '') onChange(name, defaultValue, valid(defaultValue))
  }, [value])
  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, valid(newVal))
  }
  // if no label, we are in a table so we need to minimize the row height
  const style = label ? null : { marginBottom: 0 }
  if (inline && style) {
    style.display = 'inline-block'
  }
  if (hidden) return null
  const validCheck = valid(value || defaultValue)
  // if value is null, no need to render
  if (value === null) return null
  return (
    <FormGroup style={style}>
      {label && <Label for={name}>{label}</Label>}
      <Input
        className="oi-form-input"
        type="text"
        id={name}
        name={name}
        disabled={disabled}
        invalid={validCheck !== null}
        onChange={handleChange}
        value={value || defaultValue}
      />
      <FormFeedback>{validCheck}</FormFeedback>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OibText.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  defaultValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  valid: PropTypes.func,
  inline: PropTypes.bool,
  disabled: PropTypes.bool,
  hidden: PropTypes.bool,
}
OibText.defaultProps = {
  valid: () => null,
  label: null,
  help: null,
  value: null,
  defaultValue: '',
  inline: false,
  disabled: false,
  hidden: false,
}

export default OibText
