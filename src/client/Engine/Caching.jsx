import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import { OIbText, OIbTitle, OIbCheckBox, OIbInteger } from '../components/OIbForm/index.js'
import validation from './Engine.validation.js'

const Caching = ({ onChange, caching }) => (
  <>
    <OIbTitle label="Cache parameters">
      <>
        <p>
          In case communication errors prevent OIBus to send information to a North application, the values will be stored in a local cache (one
          cache is needed for each North application) and they will be retried regularly.
        </p>
        <p>
          When the communication is restored, all values in the cache will be forwarded to the North application. The location of these caches on the
          OIBus server is indicated in the cache folder parameters.
        </p>
        <p>
          When OIBus manage files, it is possible to set the Archive mode to ask to the cache to delete files once they have been sent to the North
          application or to archive them in the archive folder.
        </p>
        <p>
          When the archive mode is activated, it is possible to set a retention Duration to define how long the files will remain
          in the archive folder. Moreover, the minimum value of 0 indicates that the files will be kept forever.
        </p>
      </>
    </OIbTitle>
    <Row>
      <Col md={4}>
        <OIbText
          label="Cache folder"
          name="engine.caching.cacheFolder"
          value={caching.cacheFolder}
          defaultValue="./cache"
          valid={validation.engine.caching.cacheFolder}
          help={<div>Where to store the cached data</div>}
          onChange={onChange}
        />
      </Col>
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
    <Row>
      <Col md={2}>
        <OIbCheckBox
          label={caching.archive.enabled ? 'Archive mode activated' : 'Archive mode deactivated'}
          name="engine.caching.archive.enabled"
          value={caching.archive.enabled}
          defaultValue
          help={<div>Move to archive folder or delete files when they are sent</div>}
          onChange={onChange}
        />
      </Col>
    </Row>
    {caching.archive.enabled && (
    <Row>
      <Col md={4}>
        <OIbText
          name="engine.caching.archive.archiveFolder"
          label="Archive folder"
          value={caching.archive.archiveFolder}
          defaultValue="./cache/archive"
          valid={validation.engine.caching.archive.archiveFolder}
          help={<div>Where to store the archived files</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={2}>
        <OIbInteger
          name="engine.caching.archive.retentionDuration"
          label="Retention duration"
          value={caching.archive.retentionDuration}
          defaultValue={720}
          valid={validation.engine.caching.archive.retentionDuration}
          help={<div>Retention period of archived files (in hours)</div>}
          onChange={onChange}
        />
      </Col>
    </Row>
    )}
  </>
)
Caching.propTypes = {
  onChange: PropTypes.func.isRequired,
  caching: PropTypes.object.isRequired,
}

export default Caching
