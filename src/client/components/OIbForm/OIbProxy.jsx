import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormText, Label, Input } from 'reactstrap'
import { ConfigContext } from '../../context/configContext.jsx'

const OIbProxy = ({ label, help, proxy, name, onChange }) => {
  const { newConfig } = React.useContext(ConfigContext)
  const { proxies } = newConfig.engine // proxies defined in engine
  let options = proxies.map((e) => e.name)
  if (options === null || options.length === 0) {
    options = [''] // allow an empty string if no proxy on engine
  }
  const defaultOption = options[0]

  React.useEffect(() => {
    if (proxy === null) onChange(name, defaultOption)
  }, [proxy])

  const handleChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, null)
  }
  // if value is null, no need to render
  if (proxy === null) return null
  return (
    <FormGroup>
      {label && <Label for={name}>{label}</Label>}
      <Input className="oi-form-input" type="select" id={name} name={name} onChange={handleChange} value={proxy}>
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
  proxy: PropTypes.string,
}
OIbProxy.defaultProps = { label: null, help: null, proxy: null }

export default OIbProxy
