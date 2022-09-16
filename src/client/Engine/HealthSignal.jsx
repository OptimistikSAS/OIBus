import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import { OIbText, OIbTitle, OIbCheckBox, OIbInteger, OIbProxy, OIbAuthentication } from '../components/OIbForm'
import validation from './Engine.validation'

const HealthSignal = ({ onChange, healthSignal }) => (
  <>
    <OIbTitle label="Health signal">
      <>
        <p>
          This component allows to send a health signal on a given frequency to the chosen host and / or in the logs
        </p>
        <p>
          The chosen http host can also be an another OIBus instance which will forward the message based on its own
          HealthSignal configuration. This behaviour is similar with the loki logs.
        </p>
        <p>
          You can check the number of forwarded messages on the OIBus health status screen looking for the
          forwardedHealthSignalMessages field.
        </p>
      </>
    </OIbTitle>
    <Row>
      <Col md={1}>
        <h6>Log (info)</h6>
      </Col>
      <Col md={1}>
        <OIbCheckBox
          label={healthSignal.logging.enabled ? 'Enabled' : 'Disabled'}
          name="engine.healthSignal.logging.enabled"
          value={healthSignal.logging.enabled}
          defaultValue={false}
          onChange={onChange}
        />
      </Col>
    </Row>
    {healthSignal.logging.enabled && (
    <Row>
      <Col md={2}>
        <OIbInteger
          label="Frequency"
          name="engine.healthSignal.logging.frequency"
          value={healthSignal.logging.frequency}
          defaultValue={3600}
          valid={validation.engine.healthSignal.logging.frequency}
          help={<div>How often to send the health signal in seconds</div>}
          onChange={onChange}
        />
      </Col>
    </Row>
    )}
    <Row>
      <Col md={1}>
        <h6>HTTP signal</h6>
      </Col>
      <Col md={1}>
        <OIbCheckBox
          label={healthSignal.http.enabled ? 'Enabled' : 'Disabled'}
          name="engine.healthSignal.http.enabled"
          value={healthSignal.http.enabled}
          defaultValue={false}
          onChange={onChange}
        />
      </Col>
    </Row>
    {healthSignal.http.enabled && (
      <Row>
        <Col md={2}>
          <OIbText
            label="Host"
            name="engine.healthSignal.http.host"
            value={healthSignal.http.host}
            defaultValue=""
            valid={validation.engine.healthSignal.http.host}
            help={<div>The host to send the health signal</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={2}>
          <OIbText
            label="Endpoint"
            name="engine.healthSignal.http.endpoint"
            value={healthSignal.http.endpoint}
            defaultValue="/engine/aliveSignal"
            valid={validation.engine.healthSignal.http.endpoint}
            help={<div>The endpoint send the health signal.</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={2}>
          <OIbInteger
            label="Frequency"
            name="engine.healthSignal.http.frequency"
            value={healthSignal.http.frequency}
            defaultValue={600}
            valid={validation.engine.healthSignal.http.frequency}
            help={<div>How often to send the health signal in seconds</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={2}>
          <OIbProxy
            label="Proxy"
            name="engine.healthSignal.http.proxy"
            value={healthSignal.http.proxy}
            defaulValue
            help={<div>Proxy name to use</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={2}>
          <OIbCheckBox
            label="Verbose"
            name="engine.healthSignal.http.verbose"
            value={healthSignal.http.verbose}
            defaultValue={false}
            help={<div>Send only version or everything</div>}
            onChange={onChange}
          />
        </Col>
      </Row>
    )}
    {healthSignal.http.enabled && (
      <Row>
        <Col md={8}>
          <OIbAuthentication
            name="engine.healthSignal.http.authentication"
            value={healthSignal.http.authentication}
            defaulValue
            onChange={onChange}
          />
        </Col>
      </Row>
    )}
  </>
)
HealthSignal.propTypes = {
  onChange: PropTypes.func.isRequired,
  healthSignal: PropTypes.object.isRequired,
}

export default HealthSignal
