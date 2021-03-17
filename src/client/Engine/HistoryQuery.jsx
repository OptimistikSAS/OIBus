import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import { OIbText, OIbTitle } from '../components/OIbForm'
import validation from './Engine.validation'

const HistoryQuery = ({ onChange, historyQuery }) => (
  <>
    <OIbTitle label="HistoryQuery parameters">
      <>
        <p>
          HistoryQuery requests are used to export high amount of data from historical capable South protocols, like OPC HDA, OPCUA HA.
          The export data is stored using CSV files in the specified folder.
          When the export is finished the data will be sent to North applications capable of handling those data.
        </p>
      </>
    </OIbTitle>
    <Row>
      <Col md={4}>
        <OIbText
          label="HistoryQuery Folder"
          name="engine.historyQuery.folder"
          value={historyQuery.folder}
          defaultValue="./historyQuery"
          valid={validation.engine.historyQuery.folder}
          help={<div>Where to store the exported data</div>}
          onChange={onChange}
        />
      </Col>
    </Row>
  </>
)
HistoryQuery.propTypes = {
  onChange: PropTypes.func.isRequired,
  historyQuery: PropTypes.object.isRequired,
}

export default HistoryQuery
