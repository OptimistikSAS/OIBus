import React from 'react'
import PropTypes from 'prop-types'
import { DateTime } from 'luxon'
import { FormGroup, FormFeedback, FormText, Label, Input, Row, Col } from 'reactstrap'

const OibDate = ({ label, help, valid, value, name, onChange, inline, hidden, maxDateString }) => {
  let dateTime = value ? DateTime.fromISO(new Date(value).toISOString()) : DateTime.now().set({ second: 0, millisecond: 0 })

  const handleTimeChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    const inputDate = newVal.split(':')
    dateTime = dateTime.set({ hour: parseInt(inputDate[0], 10), minute: parseInt(inputDate[1], 10) })
    onChange(name, dateTime.toISO(), valid(newVal))
  }

  const handleDateChange = (event) => {
    const { target } = event
    const { value: newVal } = target

    const inputDate = newVal.split('-')
    dateTime = dateTime.set({ year: parseInt(inputDate[0], 10), month: parseInt(inputDate[1], 10), day: parseInt(inputDate[2], 10) })
    onChange(name, dateTime.toISO(), valid(newVal))
  }

  const style = label ? null : { marginBottom: 0 }
  if (inline && style) {
    style.display = 'inline-block'
  }
  if (hidden) return null
  const validCheck = valid(value)

  const formattedDate = value ? DateTime.fromISO(new Date(value).toISOString()).toFormat('yyyy-MM-dd') : ''
  const formattedTime = value ? DateTime.fromISO(new Date(value).toISOString()).toFormat('HH:mm') : ''
  const dateId = `${name}Date`
  const timeId = `${name}Time`

  return (
    <FormGroup style={style}>
      <Row className="align-items-sm-baseline">
        <Col className="col-sm-auto">
          {label && <Label for={dateId}>{label}</Label>}
        </Col>
        <Col className="col-sm-auto">
          <Input
            className="oi-form-input"
            type="date"
            id={dateId}
            max={maxDateString}
            value={formattedDate}
            placeholder="yyyy-mm-ddThh:mm:ss+hh:mm"
            required
            onChange={handleDateChange}
          />
        </Col>
        <Col className="col-sm-auto">
          <Input
            className="oi-form-input"
            type="time"
            id={timeId}
            max={maxDateString}
            value={formattedTime}
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
