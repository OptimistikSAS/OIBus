import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useHistory } from 'react-router-dom'
import { Form, Row, Col, Button } from 'reactstrap'
import { FaPencilAlt } from 'react-icons/fa'
import { OIbTitle, OIbCheckBox, OIbScanMode, OIbLogLevel } from '../../components/OIbForm'
import OIbForm from '../../components/OIbForm/OIbForm.jsx'
import validation from './South.validation'
import EditableIdField from '../../components/EditableIdField.jsx'
import { ConfigContext } from '../../context/configContext.jsx'
import ProtocolSchemas from '../Protocols.jsx'
import PointsButton from '../PointsButton.jsx'
import StatusButton from '../StatusButton.jsx'

const SouthForm = ({ dataSource, dataSourceIndex, onChange }) => {
  const { id, protocol } = dataSource
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const [renamingConnector, setRenamingConnector] = useState(null)
  const [pencil, setPencil] = useState(true)
  const dataSources = newConfig?.south?.dataSources ?? []
  const history = useHistory()
  // Create the sections for the protocol (for example dataSource.Modbus) for dataSource not yet initialized
  if (!dataSource[protocol]) dataSource[protocol] = {}
  if (!dataSource.points) {
    dataSource.points = []
  }
  // load the proper schema based on the protocol name.
  // in case of SQLDbToFile protocol load schema based on selected driver
  const schema = protocol === 'SQLDbToFile'
    ? ProtocolSchemas.SQLDbToFile.withDriver(dataSource.SQLDbToFile.driver)
    : ProtocolSchemas[protocol]
  const prefix = `south.dataSources.${dataSourceIndex}`

  /**
   * Redirects the user to the datasource's live page
   * @return {void}
   */
  const handleStatus = () => {
    const pathname = `/south/${id}/live`
    history.push({ pathname })
  }

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
      <div className="d-flex align-items-center w-100 oi-sub-nav mb-2">
        <h6 className="text-muted d-flex align-items-center pl-3 pt-1">
          <EditableIdField
            connectorName={dataSource.name}
            editing={renamingConnector === `south-${dataSource.id}`}
            fromList={dataSources}
            valid={validation.protocol.isValidName}
            nameChanged={handleConnectorNameChanged(
              `south.dataSources.${dataSources.findIndex(
                (element) => element.id === dataSource.id,
              )}.name`,
            )}
          />
          {pencil
          && (
            <Button
              close
              onClick={() => {
                setRenamingConnector(`south-${dataSource.id}`)
                setPencil(false)
              }}
            >
              <FaPencilAlt className="oi-icon ml-2" />
            </Button>
          )}
        </h6>
        <div className="pull-right mr-3">
          <StatusButton handler={handleStatus} enabled={dataSource.enabled} />
          <PointsButton dataSource={dataSource} />
        </div>
      </div>
      <Form>
        <OIbTitle label="General settings">
          <ul>
            <li>This form allows to configure protocol-specific parameters.</li>
            <li>You need to activate the protocol with the enabled checkbox.</li>
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
              switchButton
            />
          </Col>
          {!schema.points && (
            <Col md={4}>
              <OIbScanMode name={`${prefix}.scanMode`} value={dataSource.scanMode} onChange={onChange} />
            </Col>
          )}
        </Row>
        <OIbLogLevel
          name={`${prefix}.logParameters`}
          value={dataSource.logParameters}
          onChange={onChange}
        />
        <OIbForm onChange={onChange} schema={schema} name={`${prefix}.${protocol}`} values={dataSource[protocol]} />
      </Form>
    </>

  )
}

SouthForm.propTypes = {
  dataSource: PropTypes.object.isRequired,
  dataSourceIndex: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default SouthForm
