import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import { Form, Row, Col, Container } from 'reactstrap'
import { FaPencilAlt } from 'react-icons/fa'
import {
  OibTitle,
  OibCheckbox,
  OibInteger,
} from '../../components/oib-form/index.js'
import SubscribedTo from './subscribed-to.jsx'
import validation from './north.validation.js'
import EditableIdField from '../../components/editable-id-field.jsx'
import { ConfigContext } from '../../context/config-context.jsx'
import OibForm from '../../components/oib-form/oib-form.jsx'
import NorthSchemas from '../north-types.jsx'
import StatusButton from '../../components/status-button.jsx'

const NorthForm = ({ north, northIndex, onChange }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const [renamingConnector, setRenamingConnector] = useState(null)
  const [pencil, setPencil] = useState(true)
  const northConnectors = newConfig?.north ?? []
  const navigate = useNavigate()
  if (!north.settings) north.settings = {}
  if (!north.caching) north.caching = { archive: {} }
  if (!north.subscribedTo) north.subscribedTo = []

  // load the proper schema based on the North type
  const northSchema = north.type === 'RestApi' ? NorthSchemas.RestApi.withAuthType(north.settings.authType) : NorthSchemas[north.type]
  const prefix = `north.${northIndex}`
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
            connectorName={north.name}
            editing={renamingConnector === `north-${north.id}`}
            fromList={northConnectors}
            valid={validation.north.isValidName}
            nameChanged={handleConnectorNameChanged(
              `north.${northConnectors.findIndex(
                (element) => element.id === north.id,
              )}.name`,
            )}
          />
          {pencil && (
            <FaPencilAlt
              className="oi-icon mx-2"
              onClick={() => {
                setRenamingConnector(`north-${north.id}`)
                setPencil(false)
              }}
            />
          )}
        </h6>
        <div className="pull-right me-3">
          <StatusButton
            handler={() => {
              navigate(`/north/${north.id}/live`)
            }}
            enabled={north.enabled}
          />
        </div>
      </div>
      <Container fluid>
        <Form className="m-2">
          <OibTitle label="General settings">
            <ul>
              <li>This form allows to configure North-specific parameters.</li>
              <li>
                You need to activate the North connector with the enabled checkbox.
              </li>
            </ul>
          </OibTitle>
          <Row>
            <Col md={2}>
              <OibCheckbox
                name={`${prefix}.enabled`}
                label={north.enabled ? 'Enabled' : 'Disabled'}
                defaultValue={false}
                value={north.enabled}
                help={<div>Enable this North connector</div>}
                onChange={onChange}
              />
            </Col>
          </Row>
          <OibForm
            onChange={onChange}
            schema={northSchema}
            name={`${prefix}.settings`}
            values={north.settings}
          />
          <OibTitle label="Caching">
            <>
              <p>
                The cache is a local file storage to allow OIBus to store values
                or files when the communication with the north connector is
                interrupted. The more space is allocated to the cache, the
                longer the interruption can be. The parameters below are
                important to understand.
              </p>
              <ul>
                <li>
                  sendInterval: the cache will try to group a maximum of values
                  in a buffer and to send them in a single transaction. However,
                  if the sendInterval (in ms) is reached, the transaction will
                  be sent even if the buffer is not full.
                </li>
                <li>
                  Retry Interval: If the communication is broken, OIBus will try
                  to resend the buffer after this interval of time (in ms) until
                  the communication is restored.
                </li>
                <li>
                  Group Count: OIBus will try to group the number of values
                  specified here when the communication is normal. Please note
                  that one value is an JSON object with a size that can be
                  between 10 to 100 bytes.
                </li>
                <li>
                  Max Group Count: In normal operations, the group count above
                  is used but if the cache has grown because of a communication
                  issue, it will try to group the largest possible transaction
                  but limited to this count. This is to avoid a too large
                  transaction.
                </li>
              </ul>
            </>
          </OibTitle>
          <Row>
            <Col md="3">
              <OibInteger
                onChange={onChange}
                value={north.caching.sendInterval}
                defaultValue={10000}
                valid={validation.caching.sendInterval}
                name={`${prefix}.caching.sendInterval`}
                label="Send interval (ms)"
              />
            </Col>
            <Col md="3">
              <OibInteger
                onChange={onChange}
                value={north.caching.retryInterval}
                defaultValue={5000}
                valid={validation.caching.retryInterval}
                name={`${prefix}.caching.retryInterval`}
                label="Retry interval (ms)"
              />
            </Col>
            <Col md="3">
              <OibInteger
                onChange={onChange}
                value={north.caching.timeout}
                defaultValue={30}
                valid={validation.caching.timeout}
                name={`${prefix}.caching.timeout`}
                label="Timeout (s)"
              />
            </Col>
            <Col md="3">
              <OibInteger
                onChange={onChange}
                value={north.caching.retryCount}
                defaultValue={3}
                valid={validation.caching.retryCount}
                name={`${prefix}.caching.retryCount`}
                label="Retry count"
              />
            </Col>
          </Row>
          <Row>
            <Col md="3">
              <OibInteger
                onChange={onChange}
                value={north.caching.groupCount}
                name={`${prefix}.caching.groupCount`}
                defaultValue={1000}
                valid={validation.caching.groupCount}
                label="Group count"
              />
            </Col>
            <Col md="3">
              <OibInteger
                onChange={onChange}
                value={north.caching.maxSendCount}
                name={`${prefix}.caching.maxSendCount`}
                defaultValue={10000}
                valid={validation.caching.maxSendCount}
                label="Max group count"
              />
            </Col>
          </Row>
          <Row>
            <Col md={2}>
              <OibCheckbox
                label={north.caching.archive.enabled ? 'Archive mode activated' : 'Archive mode deactivated'}
                name={`${prefix}.caching.archive.enabled`}
                value={north.caching.archive.enabled}
                defaultValue={false}
                help={<div>Move to archive folder or delete files when they are sent</div>}
                onChange={onChange}
              />
            </Col>
            {north.caching.archive.enabled && (
            <Col md={2}>
              <OibInteger
                label="Retention duration (h)"
                name={`${prefix}.caching.archive.retentionDuration`}
                value={north.caching.archive.retentionDuration}
                defaultValue={720}
                valid={validation.caching.retentionDuration}
                help={<div>Retention period of archived files (in hours)</div>}
                onChange={onChange}
              />
            </Col>
            )}
          </Row>
          <SubscribedTo
            onChange={onChange}
            subscribedTo={north.subscribedTo}
            northIndex={northIndex}
          />
        </Form>
      </Container>
    </>
  )
}

NorthForm.propTypes = {
  north: PropTypes.object.isRequired,
  northIndex: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default NorthForm
