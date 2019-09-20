import React from 'react'
import PropTypes from 'prop-types'
import { Form, Row, Col } from 'reactstrap'
// import { AlertContext } from '../context/AlertContext.jsx'
import { OIbTitle, OIbCheckBox, OIbInteger, OIbText } from '../../components/OIbForm'
import SubscribedTo from './SubscribedTo.jsx'
import validation from './North.validation'

import OIConnect from '../../../north/oiconnect/OIConnect.Form.jsx'
import AliveSignal from '../../../north/alivesignal/AliveSignal.Form.jsx'
import AmazonS3 from '../../../north/amazon/AmazonS3.Form.jsx'
import Console from '../../../north/console/Console.Form.jsx'
import InfluxDB from '../../../north/influxdb/InfluxDB.Form.jsx'
import OIAnalyticsFile from '../../../north/oianalyticsfile/OIAnalyticsFile.Form.jsx'
import TimescaleDB from '../../../north/timescaledb/TimescaleDB.Form.jsx'

const ApiForms = { OIConnect, AliveSignal, AmazonS3, Console, InfluxDB, OIAnalyticsFile, TimescaleDB }

const NorthForm = ({ otherApplications, application, applicationIndex, onChange }) => {
  const { api, applicationId } = application
  // Create the sections for the api (for example application.Link) for application not yet initialized
  if (!application[api]) application[api] = {}
  if (!application.caching) {
    application.caching = {}
  }
  if (!application.subscribedTo) application.subscribedTo = []
  // load the proper form based on the api name.
  const ApiForm = ApiForms[api]
  return (
    <Form>
      <OIbTitle title={`${applicationId} parameters (api: ${api})`}>
        <>
          <ul>
            <li>This form allows to configure north-specific parameters.</li>
            <li>You need to activate the application with the enabled checkbox.</li>
          </ul>
        </>
      </OIbTitle>
      <Row>
        <Col md={2}>
          <OIbText
            label="Application Id"
            onChange={onChange}
            value={applicationId}
            valid={(val) => validation.applicationId(val, otherApplications)}
            name="applicationId"
          />
        </Col>
      </Row>
      <Row>
        <Col md={2}>
          <OIbCheckBox
            name="enabled"
            label="Enabled"
            defaultValue={false}
            value={application.enabled}
            help={<div>Enable this application</div>}
            onChange={onChange}
          />
        </Col>
      </Row>
      <ApiForm onChange={onChange} application={application} />
      <OIbTitle title="Caching">
        <>
          <p>
            The cache is a local file storage to allow OIBus to store values or files when
            the communication with the north application is interrupted. The more space is
            allocated to the cache, the longer the interruption can be. The parameters below
            are important to understand.
          </p>
          <ul>
            <li>
              sendInterval: the cache will try to group a maximum of values in a buffer and to send them
              in a single transaction. However, if the sendInterval (in ms) is reached, the transaction
              will be sent even if the buffer is not full.
            </li>
            <li>
              Retry Interval: If the communication is broken, OIBus will try to resend the buffer after
              this interval of time  (in ms) until the communication is restored.
            </li>
            <li>
              Group Count: OIBus will try to group the number of values specified here when the
              communication is normal. Please note that one value is an JSON object with a size
              that can be between 10 to 100 bytes.
            </li>
            <li>
              Max Group Count: In normal operations, the group count above is used but if
              the cache has grown because of a communication issue, it will try to group the
              largest possible transaction but limited to this count. This is to avoid a too
              large transaction.
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
            name="caching.sendInterval"
            help={<div>Send interval (ms)</div>}
          />
        </Col>
        <Col md="4">
          <OIbInteger
            onChange={onChange}
            value={application.caching.retryInterval}
            defaultValue={5000}
            valid={validation.caching.retryInterval}
            name="caching.retryInterval"
            help={<div>Retry interval (ms)</div>}
          />
        </Col>
      </Row>
      <Row>
        <Col md="4">
          <OIbInteger
            onChange={onChange}
            value={application.caching.groupCount}
            name="caching.groupCount"
            defaultValue={1000}
            valid={validation.caching.groupCount}
            help={<div>Group count</div>}
          />
        </Col>
        <Col md="4">
          <OIbInteger
            onChange={onChange}
            value={application.caching.maxSendCount}
            name="caching.maxSendCount"
            defaultValue={10000}
            valid={validation.caching.maxSendCount}
            help={<div>Max group count</div>}
          />
        </Col>
      </Row>
      <SubscribedTo onChange={onChange} subscribedTo={application.subscribedTo} applicationIndex={applicationIndex} />
    </Form>
  )
}

NorthForm.propTypes = {
  otherApplications: PropTypes.arrayOf(PropTypes.string).isRequired,
  application: PropTypes.object.isRequired,
  applicationIndex: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default NorthForm
