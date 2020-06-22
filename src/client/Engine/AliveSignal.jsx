import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import { OIbText, OIbTitle, OIbCheckBox, OIbInteger, OIbProxy, OIbAuthentication } from '../components/OIbForm'
import validation from './Engine.validation'

const AliveSignal = ({ onChange, aliveSignal }) => (
  <>
    <OIbTitle label="AliveSignal parameters">
      <>
        <p>This component allows to send an alive signal on a given frequency to the chosen host.</p>
      </>
    </OIbTitle>
    <Row>
      <Col md={3}>
        <OIbCheckBox
          label="Enabled"
          name="engine.aliveSignal.enabled"
          value={aliveSignal.enabled}
          defaultValue={false}
          onChange={onChange}
          switchButton
        />
      </Col>
    </Row>
    {aliveSignal.enabled && (
      <Row>
        <Col md={2}>
          <OIbText
            label="Host"
            name="engine.aliveSignal.host"
            value={aliveSignal.host}
            defaultValue=""
            valid={validation.engine.aliveSignal.host}
            help={<div>The host to send the alive signal</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={2}>
          <OIbText
            label="Endpoint"
            name="engine.aliveSignal.endpoint"
            value={aliveSignal.endpoint}
            defaultValue=""
            valid={validation.engine.aliveSignal.endpoint}
            help={<div>The endpoint send the alive signal</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={2}>
          <OIbText
            label="Id"
            name="engine.aliveSignal.id"
            value={aliveSignal.id}
            defaultValue="OIBus"
            valid={validation.engine.aliveSignal.id}
            help={<div>Message id</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={2}>
          <OIbInteger
            label="Frequency"
            name="engine.aliveSignal.frequency"
            value={aliveSignal.frequency}
            defaultValue={600}
            valid={validation.engine.aliveSignal.frequency}
            help={<div>How often to send the alive signal in seconds</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={2}>
          <OIbProxy
            label="Proxy"
            name="engine.aliveSignal.proxy"
            value={aliveSignal.proxy}
            defaulValue
            help={<div>Proxy name to use</div>}
            onChange={onChange}
          />
        </Col>
        <Col md={2}>
          <OIbCheckBox
            label="Verbose"
            name="engine.aliveSignal.verbose"
            value={aliveSignal.verbose}
            defaultValue={false}
            help={<div>Send only version or everything</div>}
            onChange={onChange}
          />
        </Col>
      </Row>
    )}
    {aliveSignal.enabled && (
      <Row>
        <Col md={8}>
          <OIbAuthentication
            label="AliveSignal authentication parameters"
            name="engine.aliveSignal.authentication"
            value={aliveSignal.authentication}
            defaulValue
            onChange={onChange}
          />
        </Col>
      </Row>
    )}
  </>
)
AliveSignal.propTypes = {
  onChange: PropTypes.func.isRequired,
  aliveSignal: PropTypes.object.isRequired,
}

export default AliveSignal
