import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import { Form, Row, Col, Container } from 'reactstrap'
import { FaPencilAlt } from 'react-icons/fa'
import {
  OibTitle,
  OibCheckbox,
  OibScanMode,
} from '../../components/oib-form'
import OibForm from '../../components/oib-form/oib-form.jsx'
import validation from './south.validation'
import EditableIdField from '../../components/editable-id-field.jsx'
import { ConfigContext } from '../../context/config-context.jsx'
import SouthSchemas from '../south-types.jsx'
import PointsButton from '../points-button.jsx'
import StatusButton from '../../components/status-button.jsx'

const SouthForm = ({ south, southIndex, onChange }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const [renamingConnector, setRenamingConnector] = useState(null)
  const [pencil, setPencil] = useState(true)
  const southConnectors = newConfig?.south ?? []
  const navigate = useNavigate()
  if (!south.settings) south.settings = {}
  if (!south.points) {
    south.points = []
  }
  // load the proper schema based on the south name.
  // in case of SQL South, load schema based on selected driver
  const schema = south.type === 'SQL'
    ? SouthSchemas.SQL.withDriver(south.settings.driver)
    : SouthSchemas[south.type]
  const prefix = `south.${southIndex}`

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
            connectorName={south.name}
            editing={renamingConnector === `south-${south.id}`}
            fromList={southConnectors}
            valid={validation.south.isValidName}
            nameChanged={handleConnectorNameChanged(
              `south.${southConnectors.findIndex(
                (element) => element.id === south.id,
              )}.name`,
            )}
          />
          {pencil && (
          <FaPencilAlt
            className="oi-icon mx-2"
            onClick={() => {
              setRenamingConnector(`south-${south.id}`)
              setPencil(false)
            }}
          />
          )}
        </h6>
        <div className="pull-right me-3">
          <StatusButton
            handler={() => {
              navigate(`/south/${south.id}/live`)
            }}
            enabled={south.enabled}
          />
          <PointsButton south={south} />
        </div>
      </div>
      <Container fluid>
        <Form className="m-2">
          <OibTitle label="General settings">
            <ul>
              <li>
                This form allows to configure South-specific parameters.
              </li>
              <li>
                You need to activate the South connector with the enabled checkbox.
              </li>
            </ul>
          </OibTitle>
          <Row>
            <Col md={4}>
              <OibCheckbox
                name={`${prefix}.enabled`}
                label={south.enabled ? 'Enabled' : 'Disabled'}
                defaultValue={false}
                value={south.enabled}
                help={<div>Enable this South connector</div>}
                onChange={onChange}
              />
            </Col>
            {!schema.points && (
              <Col md={4}>
                <OibScanMode
                  name={`${prefix}.scanMode`}
                  value={south.scanMode}
                  onChange={onChange}
                />
              </Col>
            )}
          </Row>
          <OibForm
            onChange={onChange}
            schema={schema}
            name={`${prefix}.settings`}
            values={south.settings}
          />
        </Form>
      </Container>
    </>
  )
}

SouthForm.propTypes = {
  south: PropTypes.object.isRequired,
  southIndex: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default SouthForm
