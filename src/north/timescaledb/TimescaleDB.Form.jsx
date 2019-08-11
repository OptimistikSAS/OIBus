import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
// import { ConfigContext } from '../context/configContext.jsx'
import { OIbText, OIbPassword } from '../../client/components/OIbForm'

const TimescaleDBForm = ({ application, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText label="User name" onChange={onChange} value={application.TimescaleDB.username} name="TimescaleDB.username" help={<div />} />
      </Col>
      <Col md="4">
        <OIbPassword label="Password" onChange={onChange} value={application.TimescaleDB.password} name="TimescaleDB.password" help={<div />} />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText label="Database" onChange={onChange} value={application.TimescaleDB.db} name="TimescaleDB.db" help={<div />} />
      </Col>
      <Col md="4">
        <OIbText label="Host" onChange={onChange} value={application.TimescaleDB.host} name="TimescaleDB.host" help={<div />} />
      </Col>
    </Row>
  </>
)
TimescaleDBForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default TimescaleDBForm
