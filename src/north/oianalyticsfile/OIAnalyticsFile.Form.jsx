import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbAuthentication, OIbSelect, OIbTitle, OIbProxy } from '../../client/components/OIbForm'
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
    <OIbAuthentication authentication={application.OIAnalyticsFile.authentication} onChange={onChange} />
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
        <OIbProxy
          label="Proxie"
          name="OIAnalyticsFile.proxy"
          proxy={application.OIAnalyticsFile.proxy}
          onChange={onChange}
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
