import React from 'react'
import PropTypes from 'prop-types'
import { Form, Row, Col } from 'reactstrap'
import { OIbTitle, OIbCheckBox, OIbText } from '../../components/OIbForm'
import ProtocolForms from '../Protocols.jsx'
import validation from './South.validation'

const SouthForm = ({ otherDataSources, dataSource, dataSourceIndex, onChange }) => {
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
            <li>This form allows to configure protocol-specific parameters.</li>
            <li>You need to activate the protocol with the enabled checkbox.</li>
          </ul>
        </>
      </OIbTitle>
      <Row>
        <Col md={2}>
          <OIbText
            label="Data Source ID"
            onChange={onChange}
            value={dataSourceId}
            valid={(val) => validation.dataSourceId(val, otherDataSources)}
            name="dataSourceId"
          />
        </Col>
      </Row>
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
      <ProtocolForm onChange={onChange} dataSource={dataSource} dataSourceIndex={dataSourceIndex} />
    </Form>
  )
}

SouthForm.propTypes = {
  otherDataSources: PropTypes.arrayOf(PropTypes.string).isRequired,
  dataSource: PropTypes.object.isRequired,
  dataSourceIndex: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default SouthForm
