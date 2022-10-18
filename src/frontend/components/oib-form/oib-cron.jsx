import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input } from 'reactstrap'
import OibSelect from './oib-select.jsx'

const OibCron = ({ label, help, valid, value, name, onChange, defaultValue }) => {
  const intervals = ['year', 'month', 'day', 'hour', 'minute', 'sec', 'msec']
  const options = ['every', 'custom']
  const commonOptions = [
    {
      every: '*',
      specific: '/',
      type: 'year',
    },
    {
      every: '* *',
      specific: '* /',
      type: 'month',
    },
    {
      every: '* * *',
      specific: '* * /',
      type: 'day',
    },
    {
      every: '* * * *',
      specific: '* * * /',
      type: 'hour',
    },
    {
      every: '* * * * *',
      specific: '* * * * /',
      type: 'minute',
    },
    {
      every: '* * * * * *',
      specific: '* * * * * /',
      type: 'sec',
    },
    {
      every: '* * * * * * *',
      specific: '* * * * * * /',
      type: 'msec',
    },
  ]
  const selectStyle = { paddingBottom: 0, marginBottom: 0 }

  React.useEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])

  // get the specified value from cron string when every is selected
  // to be used in the value input field.
  // One of defined common option is used to try to read the value
  const readSpecificValue = (common) => {
    if (value === common.every) return 1
    if (value && value.startsWith(common.specific)) {
      const result = value.replace(common.specific, '')
      // eslint-disable-next-line no-restricted-globals
      if (isNaN(result)) return null
      return Number(result)
    }
    return null
  }

  // get the currect interval from cron value string
  const readSpecificInterval = () => {
    let result = null
    commonOptions.forEach((option) => {
      if (readSpecificValue(option)) {
        result = option.type
      }
    })
    return result
  }

  const specificInterval = readSpecificInterval()
  const commonIndex = intervals.indexOf(specificInterval)
  const commonOption = commonIndex > 0 ? commonOptions[commonIndex] : null
  const intervalValue = commonOption ? readSpecificValue(commonOption) : null

  // get current type based on value
  const currentType = () => {
    if (specificInterval) return 'every'
    return 'custom'
  }

  const [type, setType] = React.useState((currentType))
  const style = label ? null : { marginBottom: 0 }

  const validCheck = valid(value)
  // if value is null, no need to render
  if (value === null) return null

  /*
    Handle cron type change
  */
  const handleTypeChange = (newValue) => {
    if (newValue !== type) {
      setType(newValue)
      switch (newValue) {
        case 'every':
          onChange(name, defaultValue, valid(defaultValue))
          break
        case 'custom':
          onChange(name, '', valid(''))
          break
        default:
          break
      }
    }
  }

  /*
    Handle value change when type is every
  */
  const handleEveryValueChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    if (Number(newVal > 0)) {
      const newCron = Number(newVal) === 1
        ? commonOption.every
        : `${commonOption.specific}${Number(newVal)}`
      onChange(name, newCron, valid(newCron))
    }
  }

  /*
    Handle interval change when type is every
  */
  const handleEveryIntervalChange = (_, newVal) => {
    const newIndex = intervals.indexOf(newVal)
    const newCron = intervalValue === 1
      ? commonOptions[newIndex].every
      : `${commonOptions[newIndex].specific}${intervalValue}`
    onChange(name, newCron, valid(newCron))
  }

  /*
    Handle text value change when type is custom
  */
  const handleCustomValueChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, valid(newVal))
  }

  // render options for every type
  const renderEveryOption = () => (
    <>
      <Input
        className="oi-form-input oi-cron-input ms-1"
        type="number"
        id={`${name}.every.value`}
        name="value"
        onChange={handleEveryValueChange}
        defaultValue={intervalValue || 1}
        placeholder="value"
        min={1}
      />
      <OibSelect
        onChange={handleEveryIntervalChange}
        value={specificInterval}
        options={intervals}
        defaultValue="msec"
        name={`${name}.interval`}
        style={selectStyle}
      />
    </>
  )

  // render option for custom type
  const renderCustomOption = () => (
    <Input
      className="oi-form-input oi-cron-custom-input ms-1"
      id={`${name}.custom`}
      type="text"
      name="value"
      onChange={handleCustomValueChange}
      value={value}
      placeholder="value"
    />
  )

  // decide needed options based on selected type
  const renderBasedOnSelectedType = () => {
    switch (type) {
      case 'every':
        return renderEveryOption()
      case 'custom':
        return renderCustomOption()
      default:
        return null
    }
  }

  return (
    <FormGroup style={style}>
      {label && <Label for={name}>{label}</Label>}
      <div style={{ display: 'flex', flexDirection: 'row', marginLeft: '3px' }}>
        <OibSelect
          onChange={(_, newValue) => handleTypeChange(newValue)}
          value={type}
          options={options}
          defaultValue="every"
          name={`${name}.type`}
          style={selectStyle}
        />
        {renderBasedOnSelectedType()}
      </div>
      <FormFeedback style={{ display: 'block' }}>{validCheck}</FormFeedback>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OibCron.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  defaultValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  valid: PropTypes.func,
}
OibCron.defaultProps = {
  valid: () => null,
  label: null,
  help: null,
  value: null,
  defaultValue: '* * * * * *',
}

export default OibCron
