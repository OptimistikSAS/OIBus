import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbPassword } from '../../client/components/OIbForm'
import validation from '../../client/helpers/validation'

const InfluxDBForm = ({ application, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="User name"
          onChange={onChange}
          value={application.InfluxDB.user}
          valid={validation.north.InfluxDB.user}
          name="InfluxDB.user"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Password"
          onChange={onChange}
          value={application.InfluxDB.password}
          valid={validation.north.InfluxDB.password}
          name="InfluxDB.password"
          help={<div />}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="Database"
          onChange={onChange}
          value={application.InfluxDB.db}
          valid={validation.north.InfluxDB.db}
          name="InfluxDB.db"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbText
          label="Host"
          onChange={onChange}
          value={application.InfluxDB.host}
          valid={validation.north.InfluxDB.host}
          name="InfluxDB.host"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbText
          label="Precision"
          onChange={onChange}
          value={application.InfluxDB.precision}
          valid={validation.north.InfluxDB.precision}
          name="InfluxDB.precision"
          help={<div />}
        />
      </Col>
    </Row>
  </>
)
InfluxDBForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default InfluxDBForm
