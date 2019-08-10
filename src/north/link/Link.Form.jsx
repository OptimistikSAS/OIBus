import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
// import { ConfigContext } from '../context/configContext.jsx'
import { OIbText, OIbPassword, OIbSelect, OIbTitle } from '../../client/components/OIbForm'

const LinkForm = ({ application, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText label="Host" onChange={onChange} value={application.Link.host} name="Link.host" help={<div>host for the target (OIBus)</div>} />
      </Col>
      <Col md="4">
        <OIbText label="End point" onChange={onChange} value={application.Link.endpoint} name="Link.endpoint" help={<div />} />
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
          name="Link.type"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbText label="User name" onChange={onChange} value={application.Link.authentication.username} name="Link.username" help={<div />} />
      </Col>
      <Col md="4">
        <OIbPassword label="Password" onChange={onChange} value={application.Link.authentication.password} name="Link.password" help={<div />} />
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
        <OIbText label="Proxie" onChange={onChange} value={application.Link.proxy} name="Link.proxy" help={<div />} />
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
          help={<div />}
        />
      </Col>
    </Row>
  </>
)
LinkForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default LinkForm
