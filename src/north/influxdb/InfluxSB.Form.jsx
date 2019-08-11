import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
// import { ConfigContext } from '../context/configContext.jsx'
import { OIbText, OIbPassword } from '../../client/components/OIbForm'

const InfluxDBForm = ({ application, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText label="User name" onChange={onChange} value={application.InfluxDB.username} name="InfluxDB.username" help={<div />} />
      </Col>
      <Col md="4">
        <OIbPassword label="Password" onChange={onChange} value={application.InfluxDB.password} name="InfluxDB.password" help={<div />} />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText label="Database" onChange={onChange} value={application.InfluxDB.db} name="InfluxDB.db" help={<div />} />
      </Col>
      <Col md="4">
        <OIbText label="Host" onChange={onChange} value={application.InfluxDB.host} name="InfluxDB.host" help={<div />} />
      </Col>
      <Col md="4">
        <OIbText label="Precision" onChange={onChange} value={application.InfluxDB.precision} name="InfluxDB.precision" help={<div />} />
      </Col>
    </Row>
  </>
)
InfluxDBForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default InfluxDBForm
