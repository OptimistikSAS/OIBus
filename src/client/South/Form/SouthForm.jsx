import React from 'react'
import PropTypes from 'prop-types'
import { Form, Row, Col } from 'reactstrap'
import { OIbTitle, OIbCheckBox } from '../../components/OIbForm'
import OIbForm from '../../components/OIbForm/OIbForm.jsx'
import { ProtocolForms, ProtocolSchemas } from '../Protocols.jsx'

const SouthForm = ({ dataSource, dataSourceIndex, onChange }) => {
  const { protocol, dataSourceId } = dataSource
  // Create the sections for the protocol (for example dataSource.Modbus) for dataSource not yet initialized
  if (!dataSource[protocol]) dataSource[protocol] = {}
  if (!dataSource.points) {
    dataSource.points = []
  }
  // load the proper schema based on the protocol name.
  const ProtocolForm = ProtocolForms[protocol]
  const schema = ProtocolSchemas[protocol]
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
          <OIbCheckBox
            name="enabled"
            label="Enabled"
            defaultValue={false}
            value={dataSource.enabled}
            help={<div>Enable this application</div>}
            onChange={onChange}
            switchButton
          />
        </Col>
      </Row>
      {schema ? (
        <OIbForm onChange={onChange} schema={schema} name={`South.${protocol}`} values={dataSource[protocol]} />
      ) : (
        <ProtocolForm onChange={onChange} dataSource={dataSource} dataSourceIndex={dataSourceIndex} />
      )}
    </Form>
  )
}

SouthForm.propTypes = {
  dataSource: PropTypes.object.isRequired,
  dataSourceIndex: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default SouthForm
