import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbTextArea, OIbInteger, OIbSelect, OIbPassword, OIbScanMode } from '../../client/components/OIbForm'
import validation from './SQLDbToFile.validation'

const SQLDbToFileForm = ({ dataSource, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Host"
          onChange={onChange}
          value={dataSource.SQLDbToFile.host}
          valid={validation.SQLDbToFile.host}
          name="SQLDbToFile.host"
          defaultValue="localhost"
          help={<div>IP address of the OPC-UA server</div>}
        />
      </Col>
      <Col md="4">
        <OIbInteger
          label="Port"
          onChange={onChange}
          value={dataSource.SQLDbToFile.port}
          valid={validation.SQLDbToFile.port}
          name="SQLDbToFile.port"
          defaultValue={1433}
          help={<div>Port number of the SQLDbToFile server</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbSelect
          label="Driver"
          onChange={onChange}
          options={['mssql', 'mysql', 'postgresql', 'oracle']}
          option={dataSource.SQLDbToFile.driver}
          defaultOption="mssql"
          name="SQLDbToFile.driver"
          help={<div>Driver SQL</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="User"
          onChange={onChange}
          value={dataSource.SQLDbToFile.username}
          valid={validation.SQLDbToFile.username}
          name="SQLDbToFile.username"
          defaultValue=""
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Password"
          onChange={onChange}
          value={dataSource.SQLDbToFile.password}
          valid={validation.SQLDbToFile.password}
          name="SQLDbToFile.password"
          defaultValue=""
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="Database"
          onChange={onChange}
          value={dataSource.SQLDbToFile.database}
          valid={validation.SQLDbToFile.database}
          name="SQLDbToFile.database"
          defaultValue="db"
          help={<div>Name of the SQL database</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbTextArea
          label="Query"
          onChange={onChange}
          value={dataSource.SQLDbToFile.query}
          valid={validation.SQLDbToFile.query}
          name="SQLDbToFile.query"
          defaultValue=""
          help={<div>SQL query</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbInteger
          label="Connection timeout"
          onChange={onChange}
          value={dataSource.SQLDbToFile.connectionTimeout}
          valid={validation.SQLDbToFile.connectionTimeout}
          defaultValue={1000}
          name="SQLDbToFile.connectionTimeout"
        />
      </Col>
      <Col md="4">
        <OIbInteger
          label="Request Timeout"
          onChange={onChange}
          value={dataSource.SQLDbToFile.requestTimeout}
          valid={validation.SQLDbToFile.requestTimeout}
          defaultValue={1000}
          name="SQLDbToFile.requestTimeout"
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="Delimiter"
          onChange={onChange}
          value={dataSource.SQLDbToFile.delimiter}
          valid={validation.SQLDbToFile.delimiter}
          name="SQLDbToFile.delimiter"
          defaultValue=","
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="Filename"
          onChange={onChange}
          value={dataSource.SQLDbToFile.filename}
          valid={validation.SQLDbToFile.filename}
          name="SQLDbToFile.filename"
          defaultValue="sql-@date.csv"
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbScanMode
          label="Scan Mode"
          name="SQLDbToFile.scanMode"
          scanMode={dataSource.SQLDbToFile.scanMode}
          onChange={onChange}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="Time Column"
          onChange={onChange}
          value={dataSource.SQLDbToFile.timeColumn}
          valid={validation.SQLDbToFile.timeColumn}
          name="SQLDbToFile.timeColumn"
          defaultValue="timestamp"
        />
      </Col>
    </Row>
  </>
)

SQLDbToFileForm.propTypes = { dataSource: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

/** this South Protocol is in "File" mode so we set renderPoints to null */
SQLDbToFileForm.renderPoints = null

export default SQLDbToFileForm
