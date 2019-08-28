import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
// import { ConfigContext } from '../context/configContext.jsx'
import { OIbText, OIbInteger, OIbCheckBox, OIbScanMode } from '../../client/components/OIbForm'

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

/**
 * The following keys will be used by the **ConfigurePoints** form to display the headers
 * and the rows that are specific for each protocol.
 * Note: alternatively, we can send a "fake" point array to get the headers
 * using: ProtocolForm.renderPoints([{}],()=>null)[0].map(el => el.value.props.title)
 * @returns {array} Headers for each column
 */
CSVForm.renderHeaders = () => ['Point Id', 'ScanMode', 'Value', 'Quality']
CSVForm.renderPoints = (points, onChange) => {
  const rows = points.map((point, index) => [
    {
      name: `points.${index}.pointId`,
      value: (
        <OIbText
          title="Point Id"
          name={`points.${index}.pointId`}
          value={point.pointId}
          onChange={onChange}
          defaultValue=""
        />
      ),
    },
    {
      name: `points.${index}.scanMode`,
      value: (
        <OIbScanMode
          name={`points.${index}.scanMode`}
          scanMode={point.scanMode}
          onChange={onChange}
        />
      ),
    },
    {
      name: `points.${index}.value`,
      value: (
        <OIbText
          title="Value"
          name={`points.${index}.value`}
          value={point.value}
          onChange={onChange}
          defaultValue=""
        />
      ),
    },
    {
      name: `points.${index}.quality`,
      value: (
        <OIbText
          title="Quality"
          name={`points.${index}.quality`}
          value={point.quality}
          onChange={onChange}
          defaultValue=""
        />
      ),
    },
  ])
  return rows
}

export default CSVForm
