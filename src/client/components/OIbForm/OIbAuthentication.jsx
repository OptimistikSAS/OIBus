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
const OIbAuthentication = ({ authentication, onChange, key, type }) => (
  <>
    <Row>
      <Col>
        <OIbTitle title="Authentication">
          <div>todo</div>
        </OIbTitle>
      </Col>
    </Row>
    {type && (
      <Row>
        <Col md="2">
          <OIbSelect
            label="Type"
            onChange={onChange}
            option={authentication.type}
            options={['Basic']}
            defaultOption="Basic"
            name="authentication.type"
            help={<div />}
          />
        </Col>
      </Row>
    )}
    {key && (
      <Row>
        <Col md="4">
          <OIbText
            label="Access Key"
            onChange={onChange}
            value={authentication.accessKey}
            valid={authentication.accessKey}
            name="authentication.accessKey"
            help={<div />}
          />
        </Col>
        <Col md="4">
          <OIbPassword
            label="Secret Key"
            onChange={onChange}
            value={authentication.secretKey}
            valid={authentication.secretKey}
            name="authentication.secretKey"
            help={<div />}
          />
        </Col>
      </Row>
    )}
    {!key && (
      <Row>
        <Col md="4">
          <OIbText
            label="User name"
            onChange={onChange}
            value={authentication.username}
            valid={authentication.username}
            name="authentication.username"
            help={<div />}
          />
        </Col>
        <Col md="4">
          <OIbPassword
            label="Password"
            onChange={onChange}
            value={authentication.password}
            valid={authentication.password}
            name="authentication.password"
            help={<div />}
          />
        </Col>
      </Row>
    )}
  </>
)
OIbAuthentication.propTypes = {
  onChange: PropTypes.func.isRequired,
  authentication: PropTypes.object,
  key: PropTypes.bool,
  type: PropTypes.bool,
}

OIbAuthentication.defaultProps = {
  authentication: { type: null, user: null, password: null },
  key: false,
  type: true,
}

export default OIbAuthentication
