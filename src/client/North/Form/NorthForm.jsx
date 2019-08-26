import React from 'react'
import PropTypes from 'prop-types'
import { Form, Row, Col } from 'reactstrap'
// import { AlertContext } from '../context/AlertContext.jsx'
import { OIbTitle, OIbCheckBox, OIbInteger } from '../../components/OIbForm'
import SubscribedTo from './SubscribedTo.jsx'

import OIConnect from '../../../north/oiconnect/OIConnect.Form.jsx'
import AliveSignal from '../../../north/alivesignal/AliveSignal.Form.jsx'
import AmazonS3 from '../../../north/amazon/AmazonS3.Form.jsx'
import Console from '../../../north/console/Console.Form.jsx'
import InfluxDB from '../../../north/influxdb/InfluxDB.Form.jsx'
import OIAnalyticsFile from '../../../north/oianalyticsfile/OIAnalyticsFile.Form.jsx'
import TimescaleDB from '../../../north/timescaledb/TimescaleDB.Form.jsx'

const ApiForms = { OIConnect, AliveSignal, AmazonS3, Console, InfluxDB, OIAnalyticsFile, TimescaleDB }

const NorthForm = ({ application, applicationIndex, onChange }) => {
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
            <li>...</li>
          </ul>
        </>
      </OIbTitle>
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
      <OIbTitle title="Caching" />
      <Row>
        <Col md="4">
          <OIbInteger
            onChange={onChange}
            value={application.caching.sendInterval}
            defaultValue={10000}
            name="caching.sendInterval"
            help={<div>Value in milliseconds for data sending interval</div>}
          />
        </Col>
        <Col md="4">
          <OIbInteger
            onChange={onChange}
            value={application.caching.retryInterval}
            defaultValue={5000}
            name="caching.retryInterval"
            help={<div>Value in milliseconds for retry sending data in case of failure</div>}
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
            help={<div>The minimum buffer that will ensure date is not sent until value is reached</div>}
          />
        </Col>
        <Col md="4">
          <OIbInteger
            onChange={onChange}
            value={application.caching.maxSendCount}
            name="caching.maxSendCount"
            defaultValue={10000}
            help={<div />}
          />
        </Col>
      </Row>
      <SubscribedTo onChange={onChange} subscribedTo={application.subscribedTo} applicationIndex={applicationIndex} />
    </Form>
  )
}

NorthForm.propTypes = { application: PropTypes.object.isRequired, applicationIndex: PropTypes.number.isRequired, onChange: PropTypes.func.isRequired }

export default NorthForm
