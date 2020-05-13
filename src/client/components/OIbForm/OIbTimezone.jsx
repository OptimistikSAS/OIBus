import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'

const OIbTimezone = ({ label, help, valid, value, name, onChange, defaultValue }) => {
  const options = [
    'Etc/UTC', 'Etc/GMT+12', 'Pacific/Midway', 'Pacific/Honolulu', 'Pacific/Marquesas', 'America/Anchorage', 'Pacific/Pitcairn',
    'America/Los_Angeles', 'America/Tijuana', 'America/Chihuahua', 'America/Denver', 'America/Phoenix', 'America/Chicago',
    'America/Guatemala', 'America/Mexico_City', 'America/Regina', 'America/Bogota', 'America/Indiana/Indianapolis', 'America/New_York',
    'America/Caracas', 'America/Guyana', 'America/Halifax', 'America/La_Paz', 'America/Manaus', 'America/Santiago', 'America/St_Johns',
    'America/Argentina/Buenos_Aires', 'America/Godthab', 'America/Montevideo', 'America/Sao_Paulo',
    'Atlantic/South_Georgia', 'Atlantic/Azores', 'Atlantic/Cape_Verde', 'Africa/Casablanca', 'Africa/Monrovia', 'Europe/London',
    'Africa/Algiers', 'Africa/Windhoek', 'Europe/Belgrade', 'Europe/Berlin', 'Europe/Brussels', 'Europe/Warsaw', 'Africa/Cairo',
    'Africa/Harare', 'Asia/Amman', 'Asia/Beirut', 'Asia/Jerusalem', 'Europe/Athens', 'Europe/Helsinki', 'Europe/Minsk', 'Europe/Paris',
    'Africa/Nairobi', 'Asia/Baghdad', 'Asia/Kuwait', 'Europe/Moscow', 'Asia/Tehran', 'Asia/Baku', 'Asia/Muscat', 'Asia/Tbilisi',
    'Asia/Yerevan', 'Asia/Kabul', 'Asia/Karachi', 'Asia/Tashkent', 'Asia/Yekaterinburg', 'Asia/Colombo', 'Asia/Kolkata',
    'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Novosibirsk', 'Asia/Rangoon', 'Asia/Bangkok', 'Asia/Krasnoyarsk', 'Asia/Hong_Kong',
    'Asia/Irkutsk', 'Asia/Kuala_Lumpur', 'Asia/Taipei', 'Australia/Perth', 'Asia/Seoul', 'Asia/Tokyo', 'Asia/Yakutsk',
    'Australia/Adelaide', 'Australia/Darwin', 'Asia/Vladivostok', 'Australia/Brisbane', 'Australia/Hobart', 'Australia/Sydney',
    'Pacific/Guam', 'Australia/Lord_Howe', 'Asia/Magadan', 'Pacific/Norfolk', 'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Tongatapu',
  ]

  React.useEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])

  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, null, valid(newVal))
  }

  const validCheck = valid(value)
  // if value is null, no need to render
  if (value === null) return null
  return (
    <FormGroup>
      {label && <Label for={name}>{label}</Label>}
      <Input className="oi-form-input" type="select" id={name} name={name} onChange={handleChange} value={value} invalid={validCheck !== null}>
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
OIbTimezone.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.element,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string,
  defaultValue: PropTypes.string,
  valid: PropTypes.func,
}
OIbTimezone.defaultProps = {
  label: null,
  help: <div>Time Zone</div>,
  defaultValue: 'Europe/Paris',
  value: null,
  valid: () => null,
}

export default OIbTimezone
