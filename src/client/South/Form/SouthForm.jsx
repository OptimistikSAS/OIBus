import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import { Form, Row, Col, Container } from 'reactstrap'
import { FaPencilAlt } from 'react-icons/fa'
import {
  OIbTitle,
  OIbCheckBox,
  OIbScanMode,
  OIbLogLevel,
} from '../../components/OIbForm'
import OIbForm from '../../components/OIbForm/OIbForm.jsx'
import validation from './South.validation'
import EditableIdField from '../../components/EditableIdField.jsx'
import { ConfigContext } from '../../context/ConfigContext.jsx'
import ProtocolSchemas from '../Protocols.jsx'
import PointsButton from '../PointsButton.jsx'
import StatusButton from '../../StatusButton.jsx'

const SouthForm = ({ dataSource, dataSourceIndex, onChange }) => {
  const { id, protocol } = dataSource
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const [renamingConnector, setRenamingConnector] = useState(null)
  const [pencil, setPencil] = useState(true)
  const dataSources = newConfig?.south ?? []
  const navigate = useNavigate()
  // Create the sections for the protocol (for example dataSource.Modbus) for dataSource not yet initialized
  if (!dataSource[protocol]) dataSource[protocol] = {}
  if (!dataSource.points) {
    dataSource.points = []
  }
  // load the proper schema based on the protocol name.
  // in case of SQL protocol load schema based on selected driver
  const schema = protocol === 'SQL'
    ? ProtocolSchemas.SQL.withDriver(dataSource.SQL.driver)
    : ProtocolSchemas[protocol]
  const prefix = `south.${dataSourceIndex}`

  const handleConnectorNameChanged = (name) => (oldConnectorName, newConnectorName) => {
    setRenamingConnector(null)
    dispatchNewConfig({
      type: 'update',
      name,
      value: newConnectorName,
    })
    setPencil(true)
  }

  return (
    <>
      <div className="d-flex align-items-center w-100 oi-sub-nav">
        <h6 className="text-muted d-flex align-items-center ps-3 pt-2 pb-2 mb-0">
          <EditableIdField
            connectorName={dataSource.name}
            editing={renamingConnector === `south-${dataSource.id}`}
            fromList={dataSources}
            valid={validation.protocol.isValidName}
            nameChanged={handleConnectorNameChanged(
              `south.${dataSources.findIndex(
                (element) => element.id === dataSource.id,
              )}.name`,
            )}
          />
          {pencil && (
          <FaPencilAlt
            className="oi-icon mx-2"
            onClick={() => {
              setRenamingConnector(`south-${dataSource.id}`)
              setPencil(false)
            }}
          />
          )}
        </h6>
        <div className="pull-right me-3">
          <StatusButton
            handler={() => {
              navigate(`/south/${id}/live`)
            }}
            enabled={dataSource.enabled}
          />
          <PointsButton dataSource={dataSource} />
        </div>
      </div>
      <Container fluid>
        <Form className="m-2">
          <OIbTitle label="General settings">
            <ul>
              <li>
                This form allows to configure protocol-specific parameters.
              </li>
              <li>
                You need to activate the protocol with the enabled checkbox.
              </li>
            </ul>
          </OIbTitle>
          <Row>
            <Col md={4}>
              <OIbCheckBox
                name={`${prefix}.enabled`}
                label={dataSource.enabled ? 'Enabled' : 'Disabled'}
                defaultValue={false}
                value={dataSource.enabled}
                help={<div>Enable this application</div>}
                onChange={onChange}
              />
            </Col>
            {!schema.points && (
              <Col md={4}>
                <OIbScanMode
                  name={`${prefix}.scanMode`}
                  value={dataSource.scanMode}
                  onChange={onChange}
                />
              </Col>
            )}
          </Row>
          <OIbLogLevel
            name={`${prefix}.logParameters`}
            value={dataSource.logParameters}
            onChange={onChange}
          />
          <OIbForm
            onChange={onChange}
            schema={schema}
            name={`${prefix}.${protocol}`}
            values={dataSource[protocol]}
          />
        </Form>
      </Container>
    </>
  )
}

SouthForm.propTypes = {
  dataSource: PropTypes.object.isRequired,
  dataSourceIndex: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default SouthForm
