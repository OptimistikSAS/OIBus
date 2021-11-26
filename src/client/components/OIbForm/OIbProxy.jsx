import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormText, Label, Input } from 'reactstrap'
import { ConfigContext } from '../../context/ConfigContext.jsx'

const OIbProxy = ({ label, help, value, name, onChange }) => {
  const { newConfig } = React.useContext(ConfigContext)
  const proxies = newConfig?.engine?.proxies ?? [] // proxies defined in engine
  const options = proxies.map((e) => e.name)
  options.unshift('') // allow the user to select no proxy(empty string)
  const defaultValue = options[0]

  React.useEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])

  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, null)
  }
  // if value is null, no need to render
  if (value === null) return null
  return (
    <FormGroup>
      {label && <Label for={name}>{label}</Label>}
      <Input className="oi-form-input" type="select" id={name} name={name} onChange={handleChange} value={value}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Input>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OIbProxy.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.element,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string,
}
OIbProxy.defaultProps = { label: null, help: null, value: null }

export default OIbProxy
