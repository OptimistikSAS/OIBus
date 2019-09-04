import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbInteger, OIbSelect, OIbScanMode } from '../../client/components/OIbForm'
import ScanGroups from '../../client/South/Form/ScanGroups.jsx'
import validation from '../../client/helpers/validation'

const OPCHDAForm = ({ dataSource, dataSourceIndex, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Agent Filename"
          onChange={onChange}
          value={dataSource.OPCHDA.agentFilename}
          valid={validation.south.OPCHDA.agentFilename}
          name="OPCHDA.agentFilename"
          defaultValue=""
          help={<div>Path to the HDA Agent</div>}
        />
      </Col>
      <Col md="4">
        <OIbInteger
          label="TCP Port"
          onChange={onChange}
          value={dataSource.OPCHDA.tcpPort}
          valid={validation.south.OPCHDA.tcpPort}
          name="OPCHDA.tcpPort"
          defaultValue=""
          help={<div>TCP Port of the HDA Agent executable</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbSelect
          label="Agent Logging Level"
          onChange={onChange}
          options={['silly', 'debug', 'info', 'warning', 'error']}
          option={dataSource.OPCHDA.logLevel}
          defaultOption="debug"
          name="OPCHDA.logLevel"
          help={<div>Logging Level</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="Host"
          onChange={onChange}
          value={dataSource.OPCHDA.host}
          valid={validation.south.OPCHDA.host}
          name="OPCHDA.host"
          defaultValue=""
          help={<div>IP address or hostname of the HDA server</div>}
        />
      </Col>
      <Col md="4">
        <OIbText
          label="Server Name"
          onChange={onChange}
          value={dataSource.OPCHDA.serverName}
          valid={validation.south.OPCHDA.serverName}
          name="OPCHDA.serverName"
          defaultValue=""
          help={<div>Name of the HDA server</div>}
        />
      </Col>
      <Col md="4">
        <OIbInteger
          label="Retry interval"
          onChange={onChange}
          value={dataSource.OPCHDA.retryInterval}
          valid={validation.south.OPCHDA.retryInterval}
          name="OPCHDA.retryInterval"
          defaultValue={10000}
        />
      </Col>
    </Row>
    <ScanGroups onChange={onChange} scanGroups={dataSource.scanGroups} dataSourceIndex={dataSourceIndex} />
  </>
)

OPCHDAForm.propTypes = { dataSource: PropTypes.object.isRequired, dataSourceIndex: PropTypes.number.isRequired, onChange: PropTypes.func.isRequired }

/**
 * The following keys will be used by the **ConfigurePoints** form to display the headers
 * and the rows that are specific for each protocol.
 * Note: alternatively, we can send a "fake" point array to get the headers
 * using: ProtocolForm.renderPoints([{}],()=>null)[0].map(el => el.value.props.title)
 * @returns {array} Headers for each column
 */
OPCHDAForm.renderHeaders = () => ['Point Id', 'ScanMode']
OPCHDAForm.renderPoints = (points, onChange) => {
  const rows = points.map((point, index) => [
    {
      name: `points.${index}.pointId`,
      value: (
        <OIbText
          title="Point Id"
          name={`points.${index}.pointId`}
          value={point.pointId}
          valid={validation.south.OPCHDA.points.pointId}
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
          scanMode={point.scanMode}
          onChange={onChange}
        />
      ),
    },
  ])
  return rows
}

export default OPCHDAForm
