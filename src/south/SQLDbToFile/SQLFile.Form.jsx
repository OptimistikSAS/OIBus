import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbInteger, OIbSelect, OIbPassword } from '../../client/components/OIbForm'

const SQLFileForm = ({ dataSource, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Host"
          onChange={onChange}
          value={dataSource.SQLFile.host}
          name="SQLFile.host"
          defaultValue="localhost"
          help={<div>IP address of the OPC-UA server</div>}
        />
      </Col>
      <Col md="4">
        <OIbInteger
          label="Port"
          onChange={onChange}
          value={dataSource.SQLFile.port}
          name="SQLFile.port"
          defaultValue="1433"
          help={<div>Port number of the SQLFile server</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbSelect
          label="Driver"
          onChange={onChange}
          options={['mssql', 'mysql', 'postgresql', 'oracle']}
          option={dataSource.SQLFile.driver}
          defaultValue="mssql"
          name="SQLFile.driver"
          help={<div>Driver SQL</div>}
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="User"
          onChange={onChange}
          value={dataSource.SQLFile.username}
          name="SQLFile.username"
          defaultValue=""
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Password"
          onChange={onChange}
          value={dataSource.SQLFile.password}
          name="SQLFile.password"
          defaultValue=""
        />
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="Database"
          onChange={onChange}
          value={dataSource.SQLFile.database}
          name="SQLFile.database"
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
          value={dataSource.SQLFile.query}
          name="SQLFile.query"
          defaultValue=""
          help={<div>SQL query</div>}
        />
      </Col>
    </Row>
  </>
)

SQLFileForm.propTypes = { dataSource: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default SQLFileForm
