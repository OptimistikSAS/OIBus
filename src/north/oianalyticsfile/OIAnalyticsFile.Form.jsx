import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbPassword, OIbSelect, OIbTitle } from '../../client/components/OIbForm'
import validation from './OIAnalyticsFile.validation'

const OIAnalyticsFileForm = ({ application, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Host"
          onChange={onChange}
          value={application.OIAnalyticsFile.host}
          valid={validation.OIAnalyticsFile.host}
          name="OIAnalyticsFile.host"
          help={<div>host for the target</div>}
        />
      </Col>
      <Col md="4">
        <OIbText
          label="End point"
          onChange={onChange}
          value={application.OIAnalyticsFile.endpoint}
          valid={validation.OIAnalyticsFile.endpoint}
          name="OIAnalyticsFile.endpoint"
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
          option={application.OIAnalyticsFile.authentication.type}
          options={['Basic']}
          defaultOption="Basic"
          name="OIAnalyticsFile.authentication.type"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbText
          label="User name"
          onChange={onChange}
          value={application.OIAnalyticsFile.authentication.username}
          valid={validation.OIAnalyticsFile.authentication.username}
          name="OIAnalyticsFile.authentication.username"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Password"
          onChange={onChange}
          value={application.OIAnalyticsFile.authentication.password}
          valid={validation.OIAnalyticsFile.authentication.password}
          name="OIAnalyticsFile.password"
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
          value={application.OIAnalyticsFile.proxy}
          valid={validation.OIAnalyticsFile.proxy}
          name="OIAnalyticsFile.proxy"
          help={<div />}
        />
      </Col>
    </Row>
    <Row>
      <Col md="3">
        <OIbSelect
          label="Stack"
          onChange={onChange}
          option={application.OIAnalyticsFile.stack}
          name="OIAnalyticsFile.stack"
          options={['axios', 'request', 'fetch']}
          defaultOption="fetch"
          help={<div />}
        />
      </Col>
    </Row>
  </>
)
OIAnalyticsFileForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default OIAnalyticsFileForm
