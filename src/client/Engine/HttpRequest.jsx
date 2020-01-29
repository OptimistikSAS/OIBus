import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import { OIbTitle, OIbInteger, OIbSelect } from '../components/OIbForm'
import validation from './Engine.validation'

const HttpRequest = ({ onChange, httpRequest }) => (
  <>
    <OIbTitle label="Http request parameters">
      <>
        <p>
          Centralized configuration for applications communication via HTTP requests.
        </p>
      </>
    </OIbTitle>
    <Row>
      <Col md={2}>
        <OIbSelect
          label="Stack"
          name="engine.httpRequest.stack"
          options={['axios', 'request', 'fetch']}
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
          defaultValue={600}
          valid={validation.engine.httpRequest.timeout}
          help={<div>How long to wait for the request to finish</div>}
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
