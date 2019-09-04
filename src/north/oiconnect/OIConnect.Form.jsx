import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbPassword, OIbSelect, OIbTitle } from '../../client/components/OIbForm'
import validation from '../../client/helpers/validation'

const OIConnectForm = ({ application, onChange }) => {
  if (!application.OIConnect.authentication) {
    application.OIConnect.authentication = {}
  }
  return (
    <>
      <Row>
        <Col md="4">
          <OIbText
            label="Host"
            onChange={onChange}
            value={application.OIConnect.host}
            defaultValue=""
            valid={validation.north.OIConnect.host}
            name="OIConnect.host"
            help={<div>host for the target</div>}
          />
        </Col>
        <Col md="4">
          <OIbText
            label="End point"
            onChange={onChange}
            value={application.OIConnect.endpoint}
            defaultValue=""
            valid={validation.north.OIConnect.endpoint}
            name="OIConnect.endpoint"
            help={<div />}
          />
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
            option={application.OIConnect.authentication.type}
            options={['Basic']}
            defaultOption="Basic"
            name="OIConnect.type"
            help={<div />}
          />
        </Col>
        <Col md="4">
          <OIbText
            label="User name"
            onChange={onChange}
            value={application.OIConnect.authentication.username}
            defaultValue=""
            valid={validation.north.OIConnect.authentication.username}
            name="OIConnect.username"
            help={<div />}
          />
        </Col>
        <Col md="4">
          <OIbPassword
            label="Password"
            onChange={onChange}
            value={application.OIConnect.authentication.password}
            defaultValue=""
            valid={validation.north.OIConnect.authentication.password}
            name="OIConnect.password"
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
          <OIbText
            label="Proxie"
            onChange={onChange}
            value={application.OIConnect.proxy}
            defaultValue=""
            valid={validation.north.OIConnect.proxy}
            name="OIConnect.proxy"
            help={<div />}
          />
        </Col>
      </Row>
      <Row>
        <Col md="3">
          <OIbSelect
            label="Stack"
            onChange={onChange}
            option={application.OIConnect.stack}
            name="OIConnect.stack"
            options={['axios', 'request', 'fetch']}
            defaultOption="fetch"
            help={<div />}
          />
        </Col>
      </Row>
    </>
  )
}
OIConnectForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default OIConnectForm
