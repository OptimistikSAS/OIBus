import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbTextArea = ({ label, help, valid, value, name, onChange, defaultValue }) => {
  React.useEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])
  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, valid(newVal))
  }
  // if no label, we are in a table so we need to minimize the row height
  const style = label ? null : { marginBottom: 0 }
  const validCheck = valid(value)
  // if value is null, no need to render
  if (value === null) return null
  return (
    <FormGroup style={style}>
      {label && <Label for={name}>{label}</Label>}
      <Input className="oi-form-input" type="textarea" id={name} name={name} invalid={validCheck !== null} onChange={handleChange} value={value} />
      <FormFeedback>{validCheck}</FormFeedback>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OIbTextArea.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.element,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  defaultValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  valid: PropTypes.func,
}
OIbTextArea.defaultProps = {
  valid: () => null,
  label: null,
  help: null,
  value: null,
  defaultValue: '',
}

export default OIbTextArea
