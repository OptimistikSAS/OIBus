import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import { OibCheckbox, OibInteger, OibTitle } from '../../components/oib-form/index.js'
import validation from './north.validation.js'

const Caching = ({ onChange, prefix, value }) => (
  <>
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
          value={value.sendInterval}
          defaultValue={10000}
          valid={validation.caching.sendInterval}
          name={`${prefix}.sendInterval`}
          label="Send interval (ms)"
        />
      </Col>
      <Col md="3">
        <OibInteger
          onChange={onChange}
          value={value.retryInterval}
          defaultValue={5000}
          valid={validation.caching.retryInterval}
          name={`${prefix}.retryInterval`}
          label="Retry interval (ms)"
        />
      </Col>
      <Col md="3">
        <OibInteger
          onChange={onChange}
          value={value.timeout}
          defaultValue={30}
          valid={validation.caching.timeout}
          name={`${prefix}.timeout`}
          label="Timeout (s)"
        />
      </Col>
      <Col md="3">
        <OibInteger
          onChange={onChange}
          value={value.retryCount}
          defaultValue={3}
          valid={validation.caching.retryCount}
          name={`${prefix}.retryCount`}
          label="Retry count"
        />
      </Col>
    </Row>
    <Row>
      <Col md="3">
        <OibInteger
          onChange={onChange}
          value={value.groupCount}
          name={`${prefix}.groupCount`}
          defaultValue={1000}
          valid={validation.caching.groupCount}
          label="Group count"
        />
      </Col>
      <Col md="3">
        <OibInteger
          onChange={onChange}
          value={value.maxSendCount}
          name={`${prefix}.maxSendCount`}
          defaultValue={10000}
          valid={validation.caching.maxSendCount}
          label="Max group count"
        />
      </Col>
    </Row>
    <Row>
      <Col md={2}>
        <OibCheckbox
          label={value.archive.enabled ? 'Archive mode activated' : 'Archive mode deactivated'}
          name={`${prefix}.archive.enabled`}
          value={value.archive.enabled}
          defaultValue={false}
          help={<div>Move to archive folder or delete files when they are sent</div>}
          onChange={onChange}
        />
      </Col>
      {value.archive.enabled && (
        <Col md={2}>
          <OibInteger
            label="Retention duration (h)"
            name={`${prefix}.archive.retentionDuration`}
            value={value.archive.retentionDuration}
            defaultValue={720}
            valid={validation.caching.retentionDuration}
            help={<div>Retention period of archived files (in hours)</div>}
            onChange={onChange}
          />
        </Col>
      )}
    </Row>
  </>

)

Caching.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.object.isRequired,
  prefix: PropTypes.string.isRequired,
}

export default Caching
