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
          help={<div>IP address of the SQLDbToFile server</div>}
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
          options={['mssql']}
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
          name="scanMode"
          scanMode={dataSource.scanMode}
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
    <Row>
      <Col md="4">
        <OIbText
          label="Date Format"
          onChange={onChange}
          value={dataSource.SQLDbToFile.dateFormat}
          valid={validation.SQLDbToFile.dateFormat}
          name="SQLDbToFile.dateFormat"
          defaultValue="YYYY-MM-DD HH:mm:ss.SSS"
        />
      </Col>
      <Col md="4">
        <OIbSelect
          label="Timezone"
          onChange={onChange}
          option={dataSource.SQLDbToFile.timezone}
          valid={validation.SQLDbToFile.timezone}
          defaultOption="Europe/Paris"
          name="SQLDbToFile.timezone"
          options={[
            'Etc/GMT+12', 'Pacific/Midway', 'Pacific/Honolulu', 'Pacific/Marquesas', 'America/Anchorage', 'Pacific/Pitcairn',
            'America/Los_Angeles', 'America/Tijuana', 'America/Chihuahua', 'America/Denver', 'America/Phoenix', 'America/Chicago',
            'America/Guatemala', 'America/Mexico_City', 'America/Regina', 'America/Bogota', 'America/Indiana/Indianapolis', 'America/New_York',
            'America/Caracas', 'America/Guyana', 'America/Halifax', 'America/La_Paz', 'America/Manaus', 'America/Santiago', 'America/St_Johns',
            'America/Argentina/Buenos_Aires', 'America/Godthab', 'America/Montevideo', 'America/Sao_Paulo',
            'Atlantic/South_Georgia', 'Atlantic/Azores', 'Atlantic/Cape_Verde', 'Africa/Casablanca', 'Africa/Monrovia', 'Europe/London',
            'Africa/Algiers', 'Africa/Windhoek', 'Europe/Belgrade', 'Europe/Berlin', 'Europe/Brussels', 'Europe/Warsaw', 'Africa/Cairo',
            'Africa/Harare', 'Asia/Amman', 'Asia/Beirut', 'Asia/Jerusalem', 'Europe/Athens', 'Europe/Helsinki', 'Europe/Minsk', 'Europe/Paris',
            'Africa/Nairobi', 'Asia/Baghdad', 'Asia/Kuwait', 'Europe/Moscow', 'Asia/Tehran', 'Asia/Baku', 'Asia/Muscat', 'Asia/Tbilisi',
            'Asia/Yerevan', 'Asia/Kabul', 'Asia/Karachi', 'Asia/Tashkent', 'Asia/Yekaterinburg', 'Asia/Colombo', 'Asia/Kolkata',
            'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Novosibirsk', 'Asia/Rangoon', 'Asia/Bangkok', 'Asia/Krasnoyarsk', 'Asia/Hong_Kong',
            'Asia/Irkutsk', 'Asia/Kuala_Lumpur', 'Asia/Taipei', 'Australia/Perth', 'Asia/Seoul', 'Asia/Tokyo', 'Asia/Yakutsk',
            'Australia/Adelaide', 'Australia/Darwin', 'Asia/Vladivostok', 'Australia/Brisbane', 'Australia/Hobart', 'Australia/Sydney',
            'Pacific/Guam', 'Australia/Lord_Howe', 'Asia/Magadan', 'Pacific/Norfolk', 'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Tongatapu',
          ].sort()}
        />
      </Col>
    </Row>
  </>
)

SQLDbToFileForm.propTypes = { dataSource: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

/** this South Protocol is in "File" mode so we set renderPoints to null */
SQLDbToFileForm.renderPoints = null

export default SQLDbToFileForm
