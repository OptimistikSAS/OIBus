import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import { OIbInteger, OIbTitle } from '../components/OIbForm'
import validation from './Engine.validation'

const Caching = ({ onChange, caching }) => (
  <>
    <OIbTitle label="Cache parameters">
      <>
        <p>
          In case communication errors prevent OIBus to send information to a North connector, the values will be stored in a local cache (one
          cache is needed for each North connector) and they will be retried regularly.
        </p>
        <p>
          When the communication is restored, all values in the cache will be forwarded to the North connector. The location of these caches on the
          OIBus server is indicated in the cache folder parameters.
        </p>
        <p>
          When OIBus manage files, it is possible to set the Archive mode to ask to the cache to delete files once they have been sent to the North
          connector or to archive them in the archive folder.
        </p>
        <p>
          When the archive mode is activated, it is possible to set a retention Duration to define how long the files will remain
          in the archive folder. Moreover, the minimum value of 0 indicates that the files will be kept forever.
        </p>
      </>
    </OIbTitle>
    <Row>
      <Col md={3}>
        <OIbInteger
          name="engine.caching.bufferMax"
          label="Max buffer size"
          value={caching.bufferMax}
          defaultValue={250}
          valid={validation.engine.caching.bufferMax}
          help={<div>The number of values the buffer must reach before caching values</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={3}>
        <OIbInteger
          name="engine.caching.bufferTimeoutInterval"
          label="Buffer flush interval (in ms)"
          value={caching.bufferTimeoutInterval}
          defaultValue={300}
          valid={validation.engine.caching.bufferTimeoutInterval}
          help={<div>The number of ms before flushing the buffer to cache its values</div>}
          onChange={onChange}
        />
      </Col>
    </Row>
  </>
)
Caching.propTypes = {
  onChange: PropTypes.func.isRequired,
  caching: PropTypes.object.isRequired,
}

export default Caching
