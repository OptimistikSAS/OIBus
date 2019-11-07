import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbAuthentication, OIbInteger, OIbTitle, OIbProxy } from '../../client/components/OIbForm'
import validation from './AliveSignal.validation'

const AliveSignalForm = ({ application, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Host"
          onChange={onChange}
          value={application.AliveSignal.host}
          valid={validation.AliveSignal.host}
          name="AliveSignal.host"
          help={<div>host for the target (OIBus)</div>}
        />
      </Col>
    </Row>
    <OIbAuthentication
      value={application.AliveSignal.authentication}
      validation={validation.AliveSignal.authentication}
      name="AliveSignal.authentication"
      onChange={onChange}
    />
    <Row>
      <Col>
        <OIbTitle label="Message">
          <div>todo</div>
        </OIbTitle>
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="ID"
          onChange={onChange}
          value={application.AliveSignal.id}
          valid={validation.AliveSignal.id}
          name="AliveSignal.id"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbInteger
          label="Frequency"
          onChange={onChange}
          value={application.AliveSignal.frequency}
          defaultValue={10000}
          valid={validation.AliveSignal.frequency}
          name="AliveSignal.frequency"
          help={<div />}
        />
      </Col>
    </Row>
    <OIbTitle label="Network">
      <>
        <p>Please specify here the proxy name to use</p>
        <p>(proxy names are defined in the Engine page)</p>
      </>
    </OIbTitle>
    <Row>
      <Col md="4">
        <OIbProxy
          label="Proxy"
          name="AliveSignal.proxy"
          value={application.AliveSignal.proxy}
          onChange={onChange}
          help={<div>Proxy</div>}
        />
      </Col>
    </Row>
  </>
)
AliveSignalForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default AliveSignalForm
