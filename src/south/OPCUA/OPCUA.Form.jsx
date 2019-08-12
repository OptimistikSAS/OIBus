
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
            default: 'everySecond',
          },
          ns: {
            type: 'number',
            title: 'NS',
          },
          s: {
            type: 'string',
            title: 'S',
            default: 'Counter1',
          },
        },
*/
import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbInteger, OIbSelect, OIbPassword } from '../../client/components/OIbForm'

const OPCUAForm = ({ dataSource, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Host"
          onChange={onChange}
          value={dataSource.OPCUA.host}
          name="OPCUA.host"
          defaultValue=""
          help={<div>IP address of the OPC-UA server</div>}
        />
      </Col>
      <Col md="4">
        <OIbInteger
          label="OPCUA Port"
          onChange={onChange}
          value={dataSource.OPCUA.opcuaPort}
          name="OPCUA.opcuaPort"
          defaultValue="8888"
          help={<div>Port number of the OPCUA server</div>}
        />
      </Col>
      <Col md="4">
        <OIbInteger
          label="HTTPS Port"
          onChange={onChange}
          value={dataSource.OPCUA.httpsPort}
          name="OPCUA.httpsPort"
          defaultValue="8889"
          help={<div>HTTPS port number</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbSelect
          label="OPCUA protocol"
          onChange={onChange}
          options={['mqtt', 'mqtts']}
          option={dataSource.OPCUA.mqttProtocol}
          defaultValue="mqtts"
          name="OPCUA.mqttProtocol"
          help={<div>Protocol OPCUA</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="User"
          onChange={onChange}
          value={dataSource.OPCUA.username}
          name="OPCUA.username"
          defaultValue=""
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Password"
          onChange={onChange}
          value={dataSource.OPCUA.password}
          name="OPCUA.password"
          defaultValue=""
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="End Point"
          onChange={onChange}
          value={dataSource.OPCUA.endPoint}
          name="OPCUA.endPoint"
          defaultValue=""
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbSelect
          label="Time Origin"
          onChange={onChange}
          options={['server', 'oibus']}
          option={dataSource.OPCUA.timeOrigin}
          defaultValue="server"
          name="OPCUA.timeOrigin"
          help={<div>Origin of timestamps</div>}
        />
      </Col>
    </Row>
  </>
)

OPCUAForm.propTypes = { dataSource: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default OPCUAForm
