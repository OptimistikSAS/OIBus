import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbPassword, OIbInteger, OIbSelect, OIbTitle } from '../../client/components/OIbForm'
import validation from '../../client/helpers/validation'

const AliveSignalForm = ({ application, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Host"
          onChange={onChange}
          value={application.AliveSignal.host}
          valid={validation.north.AliveSignal.host}
          name="AliveSignal.host"
          help={<div>host for the target (OIBus)</div>}
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
          option={application.AliveSignal.authentication.type}
          options={['Basic']}
          defaultOption="Basic"
          name="AliveSignal.type"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbText
          label="User name"
          onChange={onChange}
          value={application.AliveSignal.authentication.username}
          valid={validation.north.AliveSignal.authentication.username}
          name="AliveSignal.username"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Password"
          onChange={onChange}
          value={application.AliveSignal.authentication.password}
          valid={validation.north.AliveSignal.authentication.password}
          name="AliveSignal.password"
          help={<div />}
        />
      </Col>
    </Row>
    <Row>
      <Col>
        <OIbTitle title="Message">
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
          valid={validation.north.AliveSignal.id}
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
          valid={validation.north.AliveSignal.frequency}
          name="AliveSignal.frequency"
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
          value={application.AliveSignal.proxy}
          valid={validation.north.AliveSignal.proxy}
          name="AliveSignal.proxy"
          help={<div />}
        />
      </Col>
    </Row>
  </>
)
AliveSignalForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default AliveSignalForm
