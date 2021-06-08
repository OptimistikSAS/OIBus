import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'

import OIbText from './OIbText.jsx'
import OIbPassword from './OIbPassword.jsx'
import OIbSelect from './OIbSelect.jsx'
import OIbTitle from './OIbTitle.jsx'
import { notEmpty, hasLengthBetween } from '../../../services/validation.service'

/*
  OIBAuthentication is a form reused in several places. Can manage user/password (default)
  or accessKey/secretKey as well as authentication type.
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
    accessKey: notEmpty(),
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
                label="Value"
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
    <OIbTitle label={label} key="title">
      <div>
        <p>Authentication parameters</p>
        <p>Please fill the user and password to connect this application</p>
      </div>
    </OIbTitle>,
    mode === 'user' ? (
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
    ) : (
      <Row key="accessKey">
        <Col md="4">
          <OIbText
            label="Access Key"
            onChange={handleChange}
            value={value.accessKey}
            valid={validation.accessKey}
            name="accessKey"
          />
        </Col>
        <Col md="4">
          <OIbPassword
            label="Secret Key"
            onChange={handleChange}
            value={value.secretKey}
            valid={validation.secretKey}
            name="secretKey"
          />
        </Col>
      </Row>
    ),
  ]
}

OIbAuthentication.propTypes = {
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.object,
  mode: PropTypes.oneOf(['accessKey', 'user']),
  label: PropTypes.string,
}

OIbAuthentication.defaultProps = {
  value: { type: 'Basic', username: '', password: '', key: '', accessKey: '', secretKey: '' },
  mode: 'user',
  label: 'Authentication',
}

export default OIbAuthentication
