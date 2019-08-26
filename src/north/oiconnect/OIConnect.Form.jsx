import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
// import { ConfigContext } from '../context/configContext.jsx'
import { OIbText, OIbPassword, OIbSelect, OIbTitle } from '../../client/components/OIbForm'

const LinkForm = ({ application, onChange }) => {
  if (!application.Link.authentication) {
    application.Link.authentication = {}
  }
  return (
    <>
      <Row>
        <Col md="4">
          <OIbText
            label="Host"
            onChange={onChange}
            value={application.Link.host}
            defaultValue=""
            name="Link.host"
            help={<div>host for the target</div>}
          />
        </Col>
        <Col md="4">
          <OIbText label="End point" onChange={onChange} value={application.Link.endpoint} defaultValue="" name="Link.endpoint" help={<div />} />
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
            option={application.Link.authentication.type}
            options={['Basic']}
            defaultOption="Basic"
            name="Link.type"
            help={<div />}
          />
        </Col>
        <Col md="4">
          <OIbText
            label="User name"
            onChange={onChange}
            value={application.Link.authentication.username}
            defaultValue=""
            name="Link.username"
            help={<div />}
          />
        </Col>
        <Col md="4">
          <OIbPassword
            label="Password"
            onChange={onChange}
            value={application.Link.authentication.password}
            defaultValue=""
            name="Link.password"
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
          <OIbText label="Proxie" onChange={onChange} value={application.Link.proxy} defaultValue="" name="Link.proxy" help={<div />} />
        </Col>
      </Row>
      <Row>
        <Col md="3">
          <OIbSelect
            label="Stack"
            onChange={onChange}
            option={application.Link.stack}
            name="Link.stack"
            options={['axios', 'request', 'fetch']}
            defaultOption="fetch"
            help={<div />}
          />
        </Col>
      </Row>
    </>
  )
}
LinkForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default LinkForm
