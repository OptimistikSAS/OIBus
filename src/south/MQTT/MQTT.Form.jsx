/*
  points: {
    items: {
      pointId: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>List of the scan modes defined by the user</div> },
      topic: { 'ui:help': '' },
    },
  },
*/
import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbInteger, OIbSelect, OIbPassword } from '../../client/components/OIbForm'

const MQTTForm = ({ dataSource, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Server"
          onChange={onChange}
          value={dataSource.MQTT.server}
          name="MQTT.server"
          defaultValue=""
          help={<div>IP address of the MQTT server</div>}
        />
      </Col>
      <Col md="4">
        <OIbInteger
          label="Port"
          onChange={onChange}
          value={dataSource.MQTT.port}
          name="MQTT.port"
          defaultValue="8883"
          help={<div>Port number of the MQTT server</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbSelect
          label="MQTT protocol"
          onChange={onChange}
          options={['mqtt', 'mqtts']}
          option={dataSource.MQTT.mqttProtocol}
          defaultValue="mqtts"
          name="MQTT.mqttProtocol"
          help={<div>Protocol MQTT</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="User"
          onChange={onChange}
          value={dataSource.MQTT.username}
          name="MQTT.username"
          defaultValue=""
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Password"
          onChange={onChange}
          value={dataSource.MQTT.password}
          name="MQTT.password"
          defaultValue=""
        />
      </Col>
    </Row>
  </>
)

MQTTForm.propTypes = { dataSource: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

MQTTForm.pointDef = {
  pointId: { label: 'Point Id', type: 'text' },
  scanMode: { label: 'Scan Mode', type: 'text' },
  topic: { label: 'Topic', type: 'text' },
}

export default MQTTForm
