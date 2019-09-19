import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbPassword, OIbSelect, OIbTitle } from '../../client/components/OIbForm'
import validation from './OIAnalyticsFile.validation'

const OIAnalyticsFileForm = ({ application, onChange }) => (
  <>
    <OIbTitle title="Endpoint">
      <p>default endpoint for OIAnalytics is /api/optimistik/data/values/upload</p>
    </OIbTitle>
    <Row>
      <Col md="4">
        <OIbText
          label="Host"
          onChange={onChange}
          value={application.OIAnalyticsFile.host}
          valid={validation.OIAnalyticsFile.host}
          name="OIAnalyticsFile.host"
          help={<div>host</div>}
        />
      </Col>
      <Col md="4">
        <OIbText
          label="End point"
          onChange={onChange}
          value={application.OIAnalyticsFile.endpoint}
          valid={validation.OIAnalyticsFile.endpoint}
          name="OIAnalyticsFile.endpoint"
          help={<div>endpoint</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col>
        <OIbTitle title="Authentication">
          <div>Authentication parameters for the API</div>
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
          help={<div>Authentication mode</div>}
        />
      </Col>
      <Col md="4">
        <OIbText
          label="User name"
          onChange={onChange}
          value={application.OIAnalyticsFile.authentication.username}
          valid={validation.OIAnalyticsFile.authentication.username}
          name="OIAnalyticsFile.authentication.username"
          help={<div>User</div>}
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Password"
          onChange={onChange}
          value={application.OIAnalyticsFile.authentication.password}
          valid={validation.OIAnalyticsFile.authentication.password}
          name="OIAnalyticsFile.authentication.password"
          help={<div>Password</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col>
        <OIbTitle title="Network">
          <>
            <div>Please specify here network specific parameters</div>
            <ul>
              <li>Proxy: proxy name to use (proxy parameters are defined in the Engine page)</li>
              <li>
                Stack: OIBus can use several IP stacks to communicate with the host. In certain
                network configuration (firewall settings for example), it might be useful to try
                a different stack. We generally advise to leave &apos;fetch&apos; as it is
                the native nodej stack but we also use axios as it reports good messages to
                diagnostic network errors.
              </li>
            </ul>
          </>
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
          help={<div>Proxy</div>}
        />
      </Col>
      <Col md="3">
        <OIbSelect
          label="Stack"
          onChange={onChange}
          option={application.OIAnalyticsFile.stack}
          name="OIAnalyticsFile.stack"
          options={['axios', 'request', 'fetch']}
          defaultOption="fetch"
          help={<div>Stack</div>}
        />
      </Col>
    </Row>
  </>
)
OIAnalyticsFileForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default OIAnalyticsFileForm
