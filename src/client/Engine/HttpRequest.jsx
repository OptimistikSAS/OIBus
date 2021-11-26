import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import { OIbTitle, OIbInteger, OIbSelect } from '../components/OIbForm'
import validation from './Engine.validation'

const HttpRequest = ({
  onChange,
  httpRequest,
}) => (
  <>
    <OIbTitle label="Http request parameters">
      <p>
        Centralized configuration for applications communication via HTTP requests.
        <li>
          Stack: OIBus can use several IP stacks to communicate with the host. In certain network configuration
          (firewall settings for example), it might be useful to try a different stack. We generally advise to
          leave &apos;fetch&apos; as it is the native nodej stack but we also use axios as it reports good
          messages to diagnostic network errors.
        </li>
      </p>
    </OIbTitle>
    <Row>
      <Col md={2}>
        <OIbSelect
          label="Stack"
          name="engine.httpRequest.stack"
          options={['axios', 'fetch']}
          value={httpRequest.stack}
          defaultValue="fetch"
          help={<div>The stack used to send the request</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={2}>
        <OIbInteger
          label="Timeout"
          name="engine.httpRequest.timeout"
          value={httpRequest.timeout}
          defaultValue={30}
          valid={validation.engine.httpRequest.timeout}
          help={<div>How long to wait for the request to finish (in seconds)</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={2}>
        <OIbInteger
          label="Retry count"
          name="engine.httpRequest.retryCount"
          value={httpRequest.retryCount}
          defaultValue={3}
          valid={validation.engine.httpRequest.retryCount}
          help={<div>How many times to retry sending if server responds with status code 400, 500</div>}
          onChange={onChange}
        />
      </Col>
    </Row>
  </>
)
HttpRequest.propTypes = {
  onChange: PropTypes.func.isRequired,
  httpRequest: PropTypes.object.isRequired,
}
export default HttpRequest
