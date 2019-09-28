import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbCheckBox, OIbInteger, OIbScanMode } from '../../client/components/OIbForm'
import validation from './FolderScanner.validation'

const FolderScannerForm = ({ dataSource, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Input Folder"
          onChange={onChange}
          value={dataSource.FolderScanner.inputFolder}
          valid={validation.FolderScanner.inputFolder}
          name="FolderScanner.inputFolder"
          defaultValue=""
        />
      </Col>
      <Col md="4">
        <OIbScanMode
          label="Scan Mode"
          name="scanMode"
          scanMode={dataSource.scanMode}
          onChange={onChange}
        />
      </Col>
    </Row>
    <Row>
      <Col md={2}>
        <OIbCheckBox
          name="FolderScanner.preserve"
          label="Preserve Files"
          defaultValue={false}
          value={dataSource.FolderScanner.preserve}
          onChange={onChange}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbInteger
          label="Minimum Age"
          onChange={onChange}
          value={dataSource.FolderScanner.minAge}
          valid={validation.FolderScanner.minAge}
          defaultValue={1000}
          name="FolderScanner.minAge"
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="RegExp"
          onChange={onChange}
          value={dataSource.FolderScanner.regex}
          valid={validation.FolderScanner.regex}
          name="FolderScanner.regex"
          defaultValue=".txt"
        />
      </Col>
    </Row>
  </>
)

FolderScannerForm.propTypes = { dataSource: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

/** this South Protocol is in "File" mode so we set renderPoints to null */
FolderScannerForm.renderPoints = null

export default FolderScannerForm
