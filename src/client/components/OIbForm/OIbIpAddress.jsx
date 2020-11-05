import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'
import { isIp } from '../../../services/validation.service'

const OIbIpAddress = ({ label, help, value, name, onChange, defaultValue, inline }) => {
  React.useEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])
  // valid if ip pattern is detected
  const valid = isIp()
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
  const validCheck = valid(value)
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
        invalid={validCheck !== null}
        onChange={handleChange}
        value={value}
      />
      <FormFeedback>{validCheck}</FormFeedback>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OIbIpAddress.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  defaultValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  inline: PropTypes.bool,
}
OIbIpAddress.defaultProps = {
  label: null,
  help: null,
  value: null,
  defaultValue: '',
  inline: false,
}

export default OIbIpAddress
