import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
// import { ConfigContext } from '../context/configContext.jsx'
import { OIbText, OIbPassword, OIbSelect, OIbTitle } from '../../client/components/OIbForm'

const RawFileSenderForm = ({ application, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Host"
          onChange={onChange}
          value={application.RawFileSender.host}
          name="RawFileSender.host"
          help={<div>host for the target</div>}
        />
      </Col>
      <Col md="4">
        <OIbText label="End point" onChange={onChange} value={application.RawFileSender.endpoint} name="RawFileSender.endpoint" help={<div />} />
      </Col>
    </Row>
    <Row>
      <Col>
        <OIbTitle title="Authentication">
          <div>todo</div>
        </OIbTitle>
      </Col>
    </Row>
    <Row>
      <Col md="2">
        <OIbSelect
          label="Type"
          onChange={onChange}
          option={application.RawFileSender.authentication.type}
          options={['Basic']}
          name="RawFileSender.authentication.type"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbText
          label="User name"
          onChange={onChange}
          value={application.RawFileSender.authentication.username}
          name="RawFileSender.authentication.username"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Password"
          onChange={onChange}
          value={application.RawFileSender.authentication.password}
          name="RawFileSender.password"
          help={<div />}
        />
      </Col>
    </Row>
    <Row>
      <Col>
        <OIbTitle title="Network">
          <div>todo</div>
        </OIbTitle>
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText label="Proxie" onChange={onChange} value={application.RawFileSender.proxy} name="RawFileSender.proxy" help={<div />} />
      </Col>
    </Row>
    <Row>
      <Col md="3">
        <OIbSelect
          label="Stack"
          onChange={onChange}
          option={application.RawFileSender.stack}
          name="RawFileSender.stack"
          options={['axios', 'request', 'fetch']}
          help={<div />}
        />
      </Col>
    </Row>
  </>
)
RawFileSenderForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default RawFileSenderForm
