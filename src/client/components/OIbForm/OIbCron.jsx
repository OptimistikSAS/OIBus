import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbCron = ({ label, help, valid, value, name, onChange, defaultValue }) => {
  const types = ['year', 'month', 'day', 'hour', 'minute', 'sec', 'msec']
  React.useEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])

  // insert part change to value at index
  // or at end of string
  const newCronValue = (newVal, index) => {
    const parts = value.split(' ')
    if (parts.length === 0) {
      return newVal
    }
    if (parts.length < index) {
      parts.push(newVal)
      return parts.filter((e) => e !== '').join(' ')
    }
    parts[index] = newVal
    return parts.filter((e) => e !== '').join(' ')
  }

  const handleChange = (event) => {
    const { target } = event
    const { value: newVal, name: typeName } = target
    const index = types.indexOf(typeName)

    const newFinalValue = newCronValue(newVal, index)

    onChange(name, newFinalValue, valid(newFinalValue))
  }
  // if no label, we are in a table so we need to minimize the row height
  const style = label ? null : { marginBottom: 0 }

  const validCheck = valid(value)
  // if value is null, no need to render
  if (value === null) return null

  // create capitalized placeholder
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

  // get part based on index
  const valuePart = (v, i) => {
    if (v.split(' ').length > i) {
      return v.split(' ')[i]
    }
    return ''
  }

  // render input part based on index
  const renderInput = (index) => (
    <Input
      key={index}
      className="oi-form-input oi-cron-input"
      type="text"
      id={`${name}.${types[index]}`}
      name={types[index]}
      invalid={validCheck !== null}
      onChange={handleChange}
      value={valuePart(value, index)}
      placeholder={capitalize(types[index])}
    />
  )

  return (
    <FormGroup style={style}>
      {label && <Label for={name}>{label}</Label>}
      {types.map((_, index) => renderInput(index))}
      <FormFeedback>{validCheck}</FormFeedback>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OIbCron.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  defaultValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  valid: PropTypes.func,
}
OIbCron.defaultProps = {
  valid: () => null,
  label: null,
  help: null,
  value: null,
  defaultValue: '',
}

export default OIbCron
