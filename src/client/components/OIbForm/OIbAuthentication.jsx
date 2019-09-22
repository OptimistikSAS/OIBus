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
const OIbAuthentication = ({ authentication, validation, onChange, mode }) => [
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
            onChange={onChange}
            option={authentication.type}
            options={['Basic']}
            defaultOption="Basic"
            name="authentication.type"
          />
        </Col>
      </Row>,
      <Row key="user">
        <Col md="4">
          <OIbText
            label="User name"
            onChange={onChange}
            value={authentication.username}
            valid={validation.username}
            name="authentication.username"
          />
        </Col>
        <Col md="4">
          <OIbPassword
            label="Password"
            onChange={onChange}
            value={authentication.password}
            valid={validation.password}
            name="authentication.password"
          />
        </Col>
      </Row>,
    ]
  ) : (
    <Row key="accesKey">
      <Col md="4">
        <OIbText
          label="Access Key"
          onChange={onChange}
          value={authentication.accessKey}
          valid={validation.accessKey}
          name="authentication.accessKey"
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Secret Key"
          onChange={onChange}
          value={authentication.secretKey}
          valid={validation.secretKey}
          name="authentication.secretKey"
        />
      </Col>
    </Row>
  ),
]

OIbAuthentication.propTypes = {
  onChange: PropTypes.func.isRequired,
  authentication: PropTypes.object,
  validation: PropTypes.object.isRequired,
  mode: PropTypes.oneOf(['accessKey', 'user']),
}

OIbAuthentication.defaultProps = {
  authentication: { type: 'basic', username: '', password: '', accessKey: '', secretKey: '' },
  mode: 'user',
}

export default OIbAuthentication
