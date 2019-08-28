import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbInteger, OIbScanMode } from '../../client/components/OIbForm'

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

/**
 * The following keys will be used by the **ConfigurePoints** form to display the headers
 * and the rows that are specific for each protocol.
 * Note: alternatively, we can send a "fake" point array to get the headers
 * using: ProtocolForm.renderPoints([{}],()=>null)[0].map(el => el.value.props.title)
 * @returns {array} Headers for each column
 */
ModbusForm.renderHeaders = () => ['Point Id', 'ScanMode', 'Address', 'Type']
ModbusForm.renderPoints = (points, onChange) => {
  const rows = points.map((point, index) => [
    {
      name: `points.${index}.pointId`,
      value: (
        <OIbText
          title="Point Id"
          name={`points.${index}.pointId`}
          value={point.pointId}
          onChange={onChange}
          defaultValue=""
        />
      ),
    },
    {
      name: `points.${index}.scanMode`,
      value: (
        <OIbScanMode
          name={`points.${index}.scanMode`}
          option={point.scanMode}
          onChange={onChange}
        />
      ),
    },
    {
      name: `points.${index}.address`,
      value: (
        <OIbText
          title="Address"
          name={`points.${index}.address`}
          value={point.address}
          onChange={onChange}
          defaultValue=""
        />
      ),
    },
    {
      name: `points.${index}.type`,
      value: (
        <OIbText
          title="Type"
          name={`points.${index}.type`}
          value={point.type}
          onChange={onChange}
          defaultValue=""
        />
      ),
    },
  ])
  return rows
}

export default ModbusForm
