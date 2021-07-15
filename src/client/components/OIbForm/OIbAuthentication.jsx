import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'

import OIbText from './OIbText.jsx'
import OIbPassword from './OIbPassword.jsx'
import OIbSelect from './OIbSelect.jsx'
import { hasLengthBetween, notEmpty } from '../../../services/validation.service'

/*
  OIBAuthentication is a form reused in several places.
  Can manage Bearer token, basic auth and custom api key authentication methods
*/
const OIbAuthentication = ({ value, name, onChange, mode, label }) => {
  const [authMode, setAuthMode] = useState(value.type)

  const handleChange = (attributeName, newValue, valid) => {
    onChange(`${name}.${attributeName}`, newValue, valid)
  }

  const changeAuthType = (attributeName, newValue, valid) => {
    setAuthMode(newValue)
    onChange(`${name}.${attributeName}`, newValue, valid)
  }

  const validation = {
    secretKey: hasLengthBetween(0, 256),
    username: notEmpty(),
    password: hasLengthBetween(0, 256),
    key: notEmpty(),
    token: notEmpty(),
  }

  const renderUserType = (auth) => {
    switch (auth) {
      case 'Basic':
        return (
          <Row key="user">
            <Col md="4">
              <OIbText
                label="User name"
                onChange={handleChange}
                value={value.username}
                valid={validation.username}
                name="username"
              />
            </Col>
            <Col md="4">
              <OIbPassword
                label="Password"
                onChange={handleChange}
                value={value.password}
                valid={validation.password}
                name="password"
              />
            </Col>
          </Row>
        )
      case 'API Key':
        return (
          <Row key="user">
            <Col md="4">
              <OIbText
                label="Key"
                onChange={handleChange}
                value={value.key}
                valid={validation.key}
                name="key"
              />
            </Col>
            <Col md="4">
              <OIbPassword
                label="Secret"
                onChange={handleChange}
                value={value.secretKey}
                valid={validation.secretKey}
                name="secretKey"
              />
            </Col>
          </Row>
        )
      case 'Bearer':
        return (
          <Row key="user">
            <Col md="4">
              <OIbPassword
                label="Token"
                onChange={handleChange}
                value={value.token}
                valid={validation.token}
                name="token"
              />
            </Col>
          </Row>
        )
      default:
        return (<></>)
    }
  }

  return [
    <h6 key="title">
      {label}
    </h6>,
    mode ? renderUserType(mode) : (
      [
        <Row key="type">
          <Col md="2">
            <OIbSelect
              label="Type"
              onChange={changeAuthType}
              value={value.type}
              options={['Basic', 'API Key', 'Bearer']}
              defaultValue="Basic"
              name="type"
            />
          </Col>
        </Row>,
        renderUserType(authMode),
      ]
    ),
  ]
}

OIbAuthentication.propTypes = {
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.object,
  mode: PropTypes.oneOf(['Basic', 'API Key', 'Bearer']),
  label: PropTypes.string,
}

OIbAuthentication.defaultProps = {
  value: { type: 'Basic', username: '', password: '', key: '', secretKey: '' },
  mode: null,
  label: 'Authentication',
}

export default OIbAuthentication
