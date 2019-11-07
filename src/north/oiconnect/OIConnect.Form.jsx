import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbAuthentication, OIbSelect, OIbTitle, OIbInteger, OIbProxy } from '../../client/components/OIbForm'
import validation from './OIConnect.validation'

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
            valid={validation.OIConnect.host}
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
            valid={validation.OIConnect.endpoint}
            name="OIConnect.endpoint"
          />
        </Col>
      </Row>
      <OIbAuthentication
        value={application.OIConnect.authentication}
        validation={validation.OIConnect.authentication}
        onChange={onChange}
        name="OIConnect.authentication"
      />
      <Row>
        <Col>
          <OIbTitle label="Network">
            <>
              <div>Please specify here network specific parameters</div>
              <ul>
                <li>Proxy: proxy name to use (proxy parameters are defined in the Engine page)</li>
                <li>
                  Stack: OIBus can use several IP stacks to communicate with the host. In certain network configuration
                  (firewall settings for example), it might be useful to try a different stack. We generally advise to
                  leave &apos;fetch&apos; as it is the native nodej stack but we also use axios as it reports good
                  messages to diagnostic network errors.
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
            name="OIConnect.proxy"
            value={application.OIConnect.proxy}
            onChange={onChange}
            help={<div>Proxy</div>}
          />
        </Col>
        <Col md="3">
          <OIbSelect
            label="Stack"
            onChange={onChange}
            value={application.OIConnect.stack}
            name="OIAnalyticsFile.stack"
            options={['axios', 'request', 'fetch']}
            defaultOption="fetch"
            help={<div>Stack</div>}
          />
        </Col>
      </Row>
      <Row>
        <Col md="3">
          <OIbSelect
            label="Stack"
            onChange={onChange}
            value={application.OIConnect.stack}
            name="OIConnect.stack"
            options={['axios', 'request', 'fetch']}
            defaultOption="fetch"
            help={<div />}
          />
        </Col>
      </Row>
      <Row>
        <Col md="3">
          <OIbInteger
            label="Timeout"
            onChange={onChange}
            value={application.OIConnect.timeout}
            defaultValue=""
            valid={validation.OIConnect.timeout}
            name="OIConnect.timeout"
            help={<div />}
          />
        </Col>
      </Row>
    </>
  )
}
OIConnectForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default OIConnectForm
