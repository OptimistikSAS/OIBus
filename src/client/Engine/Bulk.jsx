import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import { OIbText, OIbTitle } from '../components/OIbForm'
import validation from './Engine.validation'

const Bulk = ({ onChange, bulk }) => (
  <>
    <OIbTitle label="Bulk parameters">
      <>
        <p>
          Bulk requests are used to export high amount of data from historical capable South protocols, like OPC HDA, OPCUA HA.
          The export data is stored using CSV files in the specified folder.
          When the export is finished the data will be sent to North applications capable of handling those data.
        </p>
      </>
    </OIbTitle>
    <Row>
      <Col md={4}>
        <OIbText
          label="Bulk Folder"
          name="engine.bulk.bulkFolder"
          value={bulk.bulkFolder}
          defaultValue="./bulk"
          valid={validation.engine.bulk.bulkFolder}
          help={<div>Where to store the exported data</div>}
          onChange={onChange}
        />
      </Col>
    </Row>
  </>
)
Bulk.propTypes = {
  onChange: PropTypes.func.isRequired,
  bulk: PropTypes.object.isRequired,
}

export default Bulk
