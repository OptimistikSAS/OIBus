import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import { OIbText, OIbSelect, OIbTitle } from '../components/OIbForm'
import validation from './Engine.validation'

const Caching = ({ onChange, caching }) => (
  <>
    <OIbTitle label="Cache parameters">
      <>
        <p>
          In case communication errors prevent OIBus to send information to a North application, The values will be stored in a local cache (one
          cache is needed for each North application) and they will be retried regularly.
        </p>
        <p>
          When the communication is restored, all values in the cache will be forwarded to the North application. The location of these caches on the
          OIBus server is indicated in the cache folder parameters.
        </p>
        <p>
          When OIBus manage files, it is possible to set the Archive mode to ask to the cache to delete files one they have been sent to the North
          application or to archive them in the Archive folder).
        </p>
      </>
    </OIbTitle>
    <Row>
      <Col md={4}>
        <OIbText
          label="Cache Folder"
          name="engine.caching.cacheFolder"
          value={caching.cacheFolder}
          defaultValue="./cache"
          valid={validation.engine.caching.cacheFolder}
          help={<div>Where to store the cached data</div>}
          onChange={onChange}
        />
      </Col>
    </Row>
    <Row>
      <Col md={4}>
        <OIbText
          name="engine.caching.archiveFolder"
          label="Archive Folder"
          value={caching.archiveFolder}
          defaultValue="./cache/archive"
          valid={validation.engine.caching.archiveFolder}
          help={<div>Where to store the cached data</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={2}>
        <OIbSelect
          label="Archive Mode"
          name="engine.caching.archiveMode"
          options={['archive', 'delete']}
          value={caching.archiveMode}
          defaultValue="archive"
          help={<div> Move to Archive Folders or Delete files</div>}
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
