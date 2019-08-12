/*
    points: {
      type: 'array',
      title: 'Points',
      items: {
        type: 'object',
        properties: {
          pointId: {
            title: 'Point ID',
            type: 'string',
          },
          scanMode: {
            title: 'Scan Mode',
            type: 'string',
          },
          address: {
            type: 'string',
            title: 'Address',
          },
          type: {
            type: 'string',
            title: 'Type',
          },
        },
      },
    },
*/

import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbInteger } from '../../client/components/OIbForm'

const ModbusForm = ({ dataSource, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Host"
          onChange={onChange}
          value={dataSource.Modbus.host}
          name="Modbus.host"
          defaultValue=""
          help={<div>IP address of the Modbus source</div>}
        />
      </Col>
      <Col md="4">
        <OIbInteger
          label="Port"
          onChange={onChange}
          value={dataSource.Modbus.port}
          name="Modbus.port"
          defaultValue="502"
          help={<div>Port number of the Modbus source</div>}
        />
      </Col>
    </Row>
  </>
)

ModbusForm.propTypes = { dataSource: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default ModbusForm
