import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { DateTime } from 'luxon'
import { Col, FormFeedback, FormGroup, FormText, Input, Label, Row } from 'reactstrap'

const OibDate = ({ label, help, valid, value, name, onChange, inline, hidden, maxDateString }) => {
  const [dateTime, setDateTime] = useState(value
    ? DateTime.fromISO(new Date(value).toISOString()) : DateTime.now().set({ second: 0, millisecond: 0 }))

  const handleTimeChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    if (!newVal) return

    const inputDate = newVal.split(':')
    const newDateTime = dateTime.set({ hour: parseInt(inputDate[0], 10), minute: parseInt(inputDate[1], 10) })
    setDateTime(newDateTime)
    onChange(name, newDateTime.toISO(), valid(newVal))
  }

  const handleDateChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    if (!newVal) return

    const inputDate = newVal.split('-')
    const newDateTime = dateTime.set({ year: parseInt(inputDate[0], 10), month: parseInt(inputDate[1], 10), day: parseInt(inputDate[2], 10) })
    setDateTime(newDateTime)
    onChange(name, newDateTime.toISO(), valid(newVal))
  }

  const style = label ? null : { marginBottom: 0 }
  if (inline && style) {
    style.display = 'inline-block'
  }
  if (hidden) return null
  const validCheck = valid(dateTime)

  return (
    <FormGroup style={style}>
      <Row className="align-items-sm-baseline">
        <Col className="col-sm-auto">
          {label && <Label for={`${name}Date`}>{label}</Label>}
        </Col>
        <Col className="col-sm-auto">
          <Input
            className="oi-form-input"
            type="date"
            id={`${name}Date`}
            max={maxDateString}
            value={dateTime.toFormat('yyyy-MM-dd')}
            placeholder="yyyy-mm-ddThh:mm:ss+hh:mm"
            required
            onChange={handleDateChange}
          />
        </Col>
        <Col className="col-sm-auto">
          <Input
            className="oi-form-input"
            type="time"
            id={`${name}Time`}
            max={maxDateString}
            value={dateTime.toFormat('HH:mm')}
            placeholder="yyyy-mm-ddThh:mm:ss+hh:mm"
            required
            onChange={handleTimeChange}
          />
        </Col>

        <FormFeedback>{validCheck}</FormFeedback>
      </Row>
      <Row>{help && <FormText>{help}</FormText>}</Row>
    </FormGroup>
  )
}
OibDate.propTypes = {
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
OibDate.defaultProps = {
  valid: () => null,
  label: null,
  help: null,
  value: null,
  inline: false,
  hidden: false,
  maxDateString: null,
}

export default OibDate
