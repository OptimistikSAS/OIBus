import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'

import OIbText from './OIbText.jsx'
import OIbPassword from './OIbPassword.jsx'
import OIbSelect from './OIbSelect.jsx'
import OIbTitle from './OIbTitle.jsx'

/*
  OIBAuthentication is a form reused in several places. Can manage user/password (default)
  or accessKey/secretKey as well as authentication type.
*/
const OIbAuthentication = ({ authentication, name, validation, onChange, mode }) => {
  const handleChange = (attributeName, value, valid) => {
    onChange(`${name}.${attributeName}`, value, valid)
  }
  return [
    <OIbTitle title="Authentication" key="title">
      <div>
        <p>Authentication paramaters</p>
        <p>Please fill the user and password to connect this application</p>
      </div>
    </OIbTitle>,
    mode === 'user' ? (
      [
        <Row key="type">
          <Col md="2">
            <OIbSelect
              label="Type"
              onChange={handleChange}
              option={authentication.type}
              options={['Basic']}
              defaultOption="Basic"
              name="type"
            />
          </Col>
        </Row>,
        <Row key="user">
          <Col md="4">
            <OIbText
              label="User name"
              onChange={handleChange}
              value={authentication.username}
              valid={validation.username}
              name="username"
            />
          </Col>
          <Col md="4">
            <OIbPassword
              label="Password"
              onChange={handleChange}
              value={authentication.password}
              valid={validation.password}
              name="password"
            />
          </Col>
        </Row>,
      ]
    ) : (
      <Row key="accesKey">
        <Col md="4">
          <OIbText
            label="Access Key"
            onChange={handleChange}
            value={authentication.accessKey}
            valid={validation.accessKey}
            name="accessKey"
          />
        </Col>
        <Col md="4">
          <OIbPassword
            label="Secret Key"
            onChange={handleChange}
            value={authentication.secretKey}
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
  authentication: PropTypes.object,
  validation: PropTypes.object.isRequired,
  mode: PropTypes.oneOf(['accessKey', 'user']),
}

OIbAuthentication.defaultProps = {
  authentication: { type: 'basic', username: '', password: '', accessKey: '', secretKey: '' },
  mode: 'user',
}

export default OIbAuthentication
