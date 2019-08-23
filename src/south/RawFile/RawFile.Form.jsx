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

/**
 * The following keys will be used by the **ConfigurePoints** form to display the headers
 * and the rows that are specific for each protocol.
 * Note: alternatively, we can send a "fake" point array to get the headers
 * using: ProtocolForm.renderPoints([{}],()=>null)[0].map(el => el.value.props.title)
 * @returns {array} Headers for each column
 */
RawFileForm.renderHeaders = () => ['Point Id', 'ScanMode']
RawFileForm.renderPoints = (points, onChange) => {
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
        <OIbText
          title="ScanMode"
          name={`points.${index}.scanMode`}
          value={point.scanMode}
          onChange={onChange}
          defaultValue="everySecond"
        />
      ),
    },
  ])
  return rows
}

export default RawFileForm
