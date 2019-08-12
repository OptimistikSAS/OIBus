import React from 'react'
import PropTypes from 'prop-types'
import { Form, Row, Col } from 'reactstrap'
import { OIbTitle, OIbCheckBox } from '../../components/OIbForm'

import CSV from '../../../south/CSV/CSV.Form.jsx'
import Modbus from '../../../south/Modbus/Modbus.Form.jsx'
import MQTT from '../../../south/MQTT/MQTT.Form.jsx'
import OPCHDA from '../../../south/OPCHDA/OPCHDA.Form.jsx'
import OPCUA from '../../../south/OPCUA/OPCUA.Form.jsx'
import RawFile from '../../../south/RawFile/RawFile.Form.jsx'
import SQLFile from '../../../south/SQLFile/SQLFile.Form.jsx'

const ProtocolForms = { CSV, Modbus, MQTT, OPCHDA, OPCUA, RawFile, SQLFile }

const SouthForm = ({ dataSource, onChange }) => {
  const { protocol, dataSourceId } = dataSource
  // Create the sections for the protocol (for example dataSource.Modbus) for dataSource not yet initialized
  if (!dataSource[protocol]) dataSource[protocol] = {}
  if (!dataSource.points) {
    dataSource.points = []
  }
  // load the proper form based on the protocol name.
  const ProtocolForm = ProtocolForms[protocol]
  return (
    <Form>
      <OIbTitle title={`${dataSourceId} parameters (protocol: ${protocol})`}>
        <>
          <ul>
            <li>...</li>
          </ul>
        </>
      </OIbTitle>
      <Row>
        <Col md={2}>
          <OIbCheckBox
            name="enabled"
            label="Enabled"
            defaultValue={false}
            value={dataSource.enabled}
            help={<div>Enable this application</div>}
            onChange={onChange}
          />
        </Col>
      </Row>
      <ProtocolForm onChange={onChange} dataSource={dataSource} />
    </Form>
  )
}

SouthForm.propTypes = { dataSource: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default SouthForm
