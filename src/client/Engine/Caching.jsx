import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import { OIbText, OIbSelect } from '../components/OIbForm'

const Caching = ({ onChange, caching }) => (
  <>
    <h2>Cache Parameters</h2>
    <Row>
      <Col md={4}>
        <OIbText
          label="Cache Folder"
          name="caching.cacheFolder"
          value={caching.cacheFolder}
          help={<div>Where to store the cached data</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={4}>
        <OIbText
          name="caching.archiveFolder"
          label="Archive Folder"
          value={caching.archiveFolder}
          help={<div>Where to store the cached data</div>}
          onChange={onChange}
        />
      </Col>
      <Col md={4}>
        <OIbSelect
          label="Archive Mode"
          name="cachine.archiveMode"
          options={['archive', 'delete']}
          option={caching.archiveMode}
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
