import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbCheckBox, OIbInteger } from '../../client/components/OIbForm'

const RawFileForm = ({ dataSource, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Input Folder"
          onChange={onChange}
          value={dataSource.RawFile.inputFolder}
          name="RawFile.inputFolder"
          defaultValue=""
        />
      </Col>
    </Row>
    <Row>
      <Col md={2}>
        <OIbCheckBox
          name="RawFile.preserve"
          label="Preserve Files"
          defaultValue={false}
          value={dataSource.RawFile.preserve}
          onChange={onChange}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbInteger
          label="Minimum Age"
          onChange={onChange}
          value={dataSource.RawFile.minAge}
          defaultValue={1000}
          name="RawFile.minAge"
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="RegExp"
          onChange={onChange}
          value={dataSource.RawFile.regex}
          name="RawFile.regex"
          defaultValue=".txt"
        />
      </Col>
    </Row>
  </>
)

RawFileForm.propTypes = { dataSource: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

/** this South Protocol is in "File" mode so we set renderPoints to null */
RawFileForm.renderPoints = null

export default RawFileForm
