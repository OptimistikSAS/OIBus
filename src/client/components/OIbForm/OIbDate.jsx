import React from 'react'
import PropTypes from 'prop-types'
import { DateTime } from 'luxon'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbDate = ({ label, help, valid, value, name, onChange, inline, hidden, maxDateString }) => {
  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, valid(newVal))
  }

  const style = label ? null : { marginBottom: 0 }
  if (inline && style) {
    style.display = 'inline-block'
  }
  if (hidden) return null
  const validCheck = valid(value)
  const formattedDate = DateTime.fromISO(new Date(value).toISOString()).toFormat('yyyy-MM-dd HH:mm')
  return (
    <FormGroup style={style}>
      {label && <Label for={name}>{label}</Label>}
      <Input
        className="oi-form-input"
        type="datetime-local"
        id={name}
        max={maxDateString}
        value={formattedDate}
        placeholder="yyyy-mm-ddThh:mm:ss+hh:mm"
        required
        onChange={handleChange}
      />
      <FormFeedback>{validCheck}</FormFeedback>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OIbDate.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.object]),
  valid: PropTypes.func,
  inline: PropTypes.bool,
  hidden: PropTypes.bool,
  maxDateString: PropTypes.string,
}
OIbDate.defaultProps = {
  valid: () => null,
  label: null,
  help: null,
  value: null,
  inline: false,
  hidden: false,
  maxDateString: null,
}

export default OIbDate
