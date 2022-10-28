import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'

import OibText from './oib-text.jsx'
import OibPassword from './oib-password.jsx'
import OibSelect from './oib-select.jsx'
import { hasLengthBetween, notEmpty } from '../../../service/validation.service'

/*
  OIBAuthentication is a form reused in several places.
  Can manage Bearer token, basic auth and custom api key authentication methods
*/
const OibAuthentication = ({ value, name, onChange, mode, label }) => {
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
              <OibText
                label="User name"
                onChange={handleChange}
                value={value.key}
                valid={validation.username}
                name="key"
              />
            </Col>
            <Col md="4">
              <OibPassword
                label="Password"
                onChange={handleChange}
                value={value.secret}
                valid={validation.password}
                name="secret"
              />
            </Col>
          </Row>
        )
      case 'API Key':
        return (
          <Row key="user">
            <Col md="4">
              <OibText
                label="Key"
                onChange={handleChange}
                value={value.key}
                valid={validation.key}
                name="key"
              />
            </Col>
            <Col md="4">
              <OibPassword
                label="Secret"
                onChange={handleChange}
                value={value.secret}
                valid={validation.secretKey}
                name="secret"
              />
            </Col>
          </Row>
        )
      case 'Bearer':
        return (
          <Row key="user">
            <Col md="4">
              <OibPassword
                label="Token"
                onChange={handleChange}
                value={value.secret}
                valid={validation.token}
                name="secret"
              />
            </Col>
          </Row>
        )
      default:
        return null
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
            <OibSelect
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

OibAuthentication.propTypes = {
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.object,
  mode: PropTypes.oneOf(['Basic', 'API Key', 'Bearer']),
  label: PropTypes.string,
}

OibAuthentication.defaultProps = {
  value: { type: 'Basic', key: '', secret: '' },
  mode: null,
  label: 'Authentication',
}

export default OibAuthentication
