import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'
import { combinedValidations, startsWithAnyOf, notEndsWith } from '../../../service/validation.service.js'

const OibLink = ({ label, help, value, protocols, name, onChange, defaultValue, inline }) => {
  React.useEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])
  // valid if starts with any of provided south and not endsWith '/'
  const valid = combinedValidations([startsWithAnyOf(protocols, '://'), notEndsWith('/')])
  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, valid(newVal))
  }
  // if no label, we are in a table, so we need to minimize the row height
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
OibLink.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  protocols: PropTypes.arrayOf(String),
  defaultValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  inline: PropTypes.bool,
}
OibLink.defaultProps = {
  label: null,
  help: null,
  value: null,
  protocols: ['http', 'https'],
  defaultValue: '',
  inline: false,
}

export default OibLink
