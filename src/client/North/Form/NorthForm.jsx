import React from 'react'
import PropTypes from 'prop-types'
import { Form, Row, Col, Breadcrumb, BreadcrumbItem } from 'reactstrap'
import { Link } from 'react-router-dom'
// import { AlertContext } from '../context/AlertContext.jsx'
import { OIbTitle, OIbCheckBox, OIbInteger, OIbLogLevel } from '../../components/OIbForm'
import SubscribedTo from './SubscribedTo.jsx'
import validation from './North.validation'
import OIbForm from '../../components/OIbForm/OIbForm.jsx'
import ApiSchemas from '../Apis.jsx'

const NorthForm = ({ application, applicationIndex, onChange }) => {
  const { api, applicationId } = application
  // Create the sections for the api (for example application.Link) for application not yet initialized
  if (!application[api]) application[api] = {}
  if (!application.caching) application.caching = {}
  if (!application.subscribedTo) application.subscribedTo = []

  // load the proper schema based on the api name.
  const schema = ApiSchemas[api]
  const prefix = `north.applications.${applicationIndex}`
  return (
    <Form>
      <Row>
        <Breadcrumb tag="h5">
          <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
            Home
          </BreadcrumbItem>
          <BreadcrumbItem tag={Link} to="/north" className="oi-breadcrumb">
            North
          </BreadcrumbItem>
          <BreadcrumbItem active tag="span">
            {applicationId}
          </BreadcrumbItem>
        </Breadcrumb>
      </Row>

      <OIbTitle label="General settings">
        <>
          <ul>
            <li>This form allows to configure north-specific parameters.</li>
            <li>You need to activate the application with the enabled checkbox.</li>
          </ul>
        </>
      </OIbTitle>
      <Row>
        <Col md={2}>
          <OIbCheckBox
            name={`${prefix}.enabled`}
            label="Enabled"
            defaultValue={false}
            value={application.enabled}
            help={<div>Enable this application</div>}
            onChange={onChange}
            switchButton
          />
        </Col>
      </Row>
      <OIbLogLevel
        name={`${prefix}.logParameters`}
        value={application.logParameters}
        onChange={onChange}
      />
      <OIbForm onChange={onChange} schema={schema} name={`${prefix}.${api}`} values={application[api]} />
      <OIbTitle label="Caching">
        <>
          <p>
            The cache is a local file storage to allow OIBus to store values or files when the communication with the
            north application is interrupted. The more space is allocated to the cache, the longer the interruption can
            be. The parameters below are important to understand.
          </p>
          <ul>
            <li>
              sendInterval: the cache will try to group a maximum of values in a buffer and to send them in a single
              transaction. However, if the sendInterval (in ms) is reached, the transaction will be sent even if the
              buffer is not full.
            </li>
            <li>
              Retry Interval: If the communication is broken, OIBus will try to resend the buffer after this interval of
              time (in ms) until the communication is restored.
            </li>
            <li>
              Group Count: OIBus will try to group the number of values specified here when the communication is normal.
              Please note that one value is an JSON object with a size that can be between 10 to 100 bytes.
            </li>
            <li>
              Max Group Count: In normal operations, the group count above is used but if the cache has grown because of
              a communication issue, it will try to group the largest possible transaction but limited to this count.
              This is to avoid a too large transaction.
            </li>
          </ul>
        </>
      </OIbTitle>
      <Row>
        <Col md="4">
          <OIbInteger
            onChange={onChange}
            value={application.caching.sendInterval}
            defaultValue={10000}
            valid={validation.caching.sendInterval}
            name={`${prefix}.caching.sendInterval`}
            label="Send interval (ms)"
          />
        </Col>
        <Col md="4">
          <OIbInteger
            onChange={onChange}
            value={application.caching.retryInterval}
            defaultValue={5000}
            valid={validation.caching.retryInterval}
            name={`${prefix}.caching.retryInterval`}
            label="Retry interval (ms)"
          />
        </Col>
      </Row>
      <Row>
        <Col md="4">
          <OIbInteger
            onChange={onChange}
            value={application.caching.groupCount}
            name={`${prefix}.caching.groupCount`}
            defaultValue={1000}
            valid={validation.caching.groupCount}
            label="Group count"
          />
        </Col>
        <Col md="4">
          <OIbInteger
            onChange={onChange}
            value={application.caching.maxSendCount}
            name={`${prefix}.caching.maxSendCount`}
            defaultValue={10000}
            valid={validation.caching.maxSendCount}
            label="Max group count"
          />
        </Col>
      </Row>
      <SubscribedTo onChange={onChange} subscribedTo={application.subscribedTo} applicationIndex={applicationIndex} />
    </Form>
  )
}

NorthForm.propTypes = {
  application: PropTypes.object.isRequired,
  applicationIndex: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default NorthForm
