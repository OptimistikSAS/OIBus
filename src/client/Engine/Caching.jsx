import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import { OIbText, OIbSelect } from '../components/OIbForm'

const Caching = ({ onChange, cache }) => (
  <Row>
    <h2>Cache Parameters</h2>
    <Col md={4}>
      <OIbText
        label="Cache Folder"
        defaultValue={cache.folder}
        help={<div>Where to store the cached data</div>}
        onChange={onChange}
      />
    </Col>
    <Col md={4}>
      <OIbText
        label="Cache Folder"
        defaultValue=""
        help={<div>Where to store the cached data</div>}
        onChange={onChange}
      />
    </Col>
    <Col md={4}>
      <OIbText
        label="Archive Folder"
        defaultValue="./cache/archived/"
        help={<div>Required when archiveMode is &apos;archive&apos; for files</div>}
        onChange={onChange}
      />
    </Col>
    <Col md={4}>
      <OIbSelect
        label="Archive Mode"
        Options={['archive', 'delete']}
        defaultOption="archive"
        help={<div> Move to Archive Folders or Delete files</div>}
        onChange={onChange}
      />
    </Col>
  </Row>
)
Caching.propTypes = {
  onChange: PropTypes.func.isRequired,
  cache: PropTypes.object.isRequired,
}

export default Caching
