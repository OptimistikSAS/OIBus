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
          defaultOption="mqtts"
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

/**
 * The following keys will be used by the ConfigurePoints form to display the headers
 * and the rows that are specific for each protocol.
 * @returns {array} Headers for each column
 */
MQTTForm.renderHeaders = () => ['Point Id', 'ScanMode', 'Topic']
MQTTForm.renderPoints = (points, onChange) => {
  const rows = points.map((point, index) => (
    [
      {
        name: `points.${index}.pointId`,
        value: <OIbText title="Point Id" name={`points.${index}.pointId`} value={point.pointId} onChange={onChange} defaultValue="" />,
      },
      {
        name: `points.${index}.scanMode`,
        value: <OIbText title="ScanMode" name={`points.${index}.scanMode`} value={point.scanMode} onChange={onChange} defaultValue="" />,
      },
      {
        name: `points.${index}.topic`,
        value: <OIbText title="Topic" name={`points.${index}.topic`} value={point.topic} onChange={onChange} defaultValue="" />,
      },
    ]
  ))
  return rows
}

export default MQTTForm
