import React from 'react'
import PropTypes from 'prop-types'
import { Form, Row, Col } from 'reactstrap'
// import { AlertContext } from '../context/AlertContext.jsx'
import { OIbTitle, OIbCheckBox, OIbInteger } from '../components/OIbForm'
import SubscribedTo from './SubscribedTo.jsx'

import Link from '../../north/link/Link.Form.jsx'

const ApiForms = { Link }

const NorthForm = ({ application, onChange }) => {
  const { api, applicationId } = application
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
          <OIbCheckBox name="enabled" label="Enabled" value={application.enabled} help={<div>Enable this application</div>} onChange={onChange} />
        </Col>
      </Row>
      <ApiForm onChange={onChange} application={application} />
      <OIbTitle title="Caching" />
      <Row>
        <Col md="4">
          <OIbInteger
            onChange={onChange}
            value={application.caching.sendInterval}
            name="caching.sendInterval"
            help={<div>Value in milliseconds for data sending interval</div>}
          />
        </Col>
        <Col md="4">
          <OIbInteger
            onChange={onChange}
            value={application.caching.retryInterval}
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
            help={<div>The minimum buffer that will ensure date is not sent until value is reached</div>}
          />
        </Col>
        <Col md="4">
          <OIbInteger onChange={onChange} value={application.caching.maxSendCount} name="caching.maxSendCount" help={<div />} />
        </Col>
      </Row>
      <SubscribedTo onChange={onChange} subscribedTo={application.subscribedTo || []} />
    </Form>
  )
}

NorthForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default NorthForm
