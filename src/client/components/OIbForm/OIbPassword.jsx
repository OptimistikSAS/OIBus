import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label, Input, InputGroup } from 'reactstrap'
import { FaEyeSlash, FaEye } from 'react-icons/fa'

const OIbPassword = ({ label, help, value, name, onChange, valid, defaultValue, hidden }) => {
  const PREFIX = '{{notEncrypted}}'
  const [edited, setEdited] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [encryptedPassword] = React.useState(value)
  /** @todo:  ask for a second password? */
  React.useLayoutEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])
  const handleChange = (event) => {
    const { target } = event
    let { value: newVal } = target
    if (!newVal.startsWith(PREFIX)) {
      if (newVal === '') {
        // keep original password, user cleared the input
        newVal = encryptedPassword
        setEdited(false)
        setShowPassword(false)
      } else {
        // add prefix to the API to know this is not encrypted
        newVal = `${PREFIX}${newVal}`
      }
    }
    onChange(name, newVal, valid(newVal.replace(PREFIX, '')))
  }
  const handleKeyDown = (event) => {
    const { target } = event
    let { value: newVal } = target
    if (!newVal.startsWith(PREFIX)) {
      if (!edited) {
        // edit started add prefix for the API to know this is not encrypted
        newVal = PREFIX
        setEdited(true)
        onChange(name, newVal, valid(newVal.replace(PREFIX, '')))
      }
    }
  }
  if (hidden) return null
  // if value is null, no need to render
  if (value === null) return null
  // if the password has not be edited, it contains the encrypted version that should not be checked
  const validCheck = edited ? valid(value.replace(PREFIX, '')) : null
  return (
    <FormGroup>
      {label && <Label for={name}>{label}</Label>}
      <InputGroup>
        <Input
          className="oi-form-input"
          type={showPassword ? 'text' : 'password'}
          id={name}
          name={name}
          invalid={validCheck !== null}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          value={value.replace(PREFIX, '')}
        />
        {edited && (
          <Input className="oi-form-append" addonType="append">
            {showPassword
              ? <FaEye onClick={() => setShowPassword(false)} />
              : <FaEyeSlash onClick={() => setShowPassword(true)} />}
          </Input>
        )}
      </InputGroup>
      <FormFeedback style={{ display: 'inline' }}>{validCheck}</FormFeedback>
      {help && <FormText>{help}</FormText>}
    </FormGroup>
  )
}
OIbPassword.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  help: PropTypes.element,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string,
  defaultValue: PropTypes.string,
  valid: PropTypes.func,
  hidden: PropTypes.bool,
}

OIbPassword.defaultProps = { valid: () => null, label: null, help: null, value: null, defaultValue: '', hidden: false }

export default OIbPassword
