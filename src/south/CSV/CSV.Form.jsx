/*
    points: {
      type: 'array',
      title: 'Points',
      items: {
        type: 'object',
        properties: {
          pointId: {
            title: 'Point ID',
            type: 'string',
          },
          scanMode: {
            title: 'Scan Mode',
            type: 'string',
          },
          value: {
            type: 'string', // TODO: Multiple types
            title: 'Value',
          },
          quality: {
            type: 'string', // TODO: Multiple types
            title: 'Quality',
          },
        },
      },
    },
    */

import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
// import { ConfigContext } from '../context/configContext.jsx'
import { OIbText, OIbInteger, OIbCheckBox } from '../../client/components/OIbForm'

const CSVForm = ({ dataSource, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Input Folder"
          onChange={onChange}
          value={dataSource.CSV.inputFolder}
          name="CSV.inputFolder"
          defaultValue="./csv/input"
          help={<div>Path to the input folder</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="Archive Folder"
          onChange={onChange}
          value={dataSource.CSV.archiveFolder}
          name="CSV.archiveFolder"
          defaultValue="./csv/archive"
          help={<div>Path to the archive folder</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="Error Folder"
          onChange={onChange}
          value={dataSource.CSV.errorFolder}
          defaultValue="./csv/error"
          name="CSV.errorFolder"
          help={<div>Path to the error folder</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="CSV separator"
          onChange={onChange}
          value={dataSource.CSV.separator}
          defaultValue=","
          name="CSV.separator"
          help={<div>(often , or ;)</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbInteger
          label="time column"
          onChange={onChange}
          value={dataSource.CSV.timeColumn}
          defaultValue={0}
          name="CSV.timeColumn"
          help={<div>Column with the timestamp</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbCheckBox
          label="Has first line"
          onChange={onChange}
          value={dataSource.CSV.hasFirstLine}
          defaultValue
          name="CSV.hasFirstLine"
          help={<div>indicates if the file starts with a header line</div>}
        />
      </Col>
    </Row>
  </>
)
CSVForm.propTypes = { dataSource: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default CSVForm
