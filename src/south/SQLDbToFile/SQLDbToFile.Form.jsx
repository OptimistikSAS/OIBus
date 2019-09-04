import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbInteger, OIbSelect, OIbPassword } from '../../client/components/OIbForm'
import validation from '../../client/helpers/validation'

const SQLDbToFileForm = ({ dataSource, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Host"
          onChange={onChange}
          value={dataSource.SQLDbToFile.host}
          valid={validation.south.SQLDbToFile.host}
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
          valid={validation.south.SQLDbToFile.port}
          name="SQLDbToFile.port"
          defaultValue="1433"
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
          valid={validation.south.SQLDbToFile.username}
          name="SQLDbToFile.username"
          defaultValue=""
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Password"
          onChange={onChange}
          value={dataSource.SQLDbToFile.password}
          valid={validation.south.SQLDbToFile.password}
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
          valid={validation.south.SQLDbToFile.database}
          name="SQLDbToFile.database"
          defaultValue="db"
          help={<div>Name of the SQL database</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="Query"
          onChange={onChange}
          value={dataSource.SQLDbToFile.query}
          valid={validation.south.SQLDbToFile.query}
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
          valid={validation.south.SQLDbToFile.connectionTimeout}
          defaultValue={1000}
          name="SQLDbToFile.connectionTimeout"
        />
      </Col>
      <Col md="4">
        <OIbInteger
          label="Request Timeout"
          onChange={onChange}
          value={dataSource.SQLDbToFile.requestTimeout}
          valid={validation.south.SQLDbToFile.requestTimeout}
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
          valid={validation.south.SQLDbToFile.delimiter}
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
          valid={validation.south.SQLDbToFile.filename}
          name="SQLDbToFile.filename"
          defaultValue="sql-@date.csv"
        />
      </Col>
    </Row>
  </>
)

SQLDbToFileForm.propTypes = { dataSource: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

/** this South Protocol is in "File" mode so we set renderPoints to null */
SQLDbToFileForm.renderPoints = null

export default SQLDbToFileForm
