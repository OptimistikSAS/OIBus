import React from 'react'
import { notEmpty, inRange, minValue } from '../../services/validation.service.js'

const schema = { name: 'SQLDbToFile' }
schema.form = {
  SQLDBtoFileSettings: {
    type: 'OIbTitle',
    label: 'SQLDBtoFile Settings',
    md: 12,
    children: (
      <>
        <p>
          SQLDbToFile periodically connects to the specified SQL server at an interval specified by scan mode.
          It gets values from the database based on the &apos;query&apos; parameter, saves the result in a CSV file
          and sends to any North capable of handling files and configured to accept files from this South.
        </p>
        <ul>
          <li>
            The query must have a specific format and contain a WHERE clause for the date range of the time column with @date1 and @date2.
          </li>
          <li>
            To prevent blocking if the SQL server is not available or the query is faulty it is possible to configure
            separate connection timeout and request timeout.
          </li>
          <li>
            It is possible to specify the delimiter used in the CSV file, how to format the timestamp field
            and also the name of the file with a template (currently only &apos;@date&apos; is accepted).
          </li>
          <li>
            Since we have no information about the SQL server it is possible to specify the time column and the timezone for it.
          </li>
        </ul>
      </>
    ),
  },
  host: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: 'localhost',
    help: <div>IP address of the SQLDbToFile server</div>,
  },
  port: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: inRange(0, 65535),
    defaultValue: 1433,
    help: <div>Port number of the SQLDbToFile server</div>,
  },
  database: {
    type: 'OIbText',
    defaultValue: 'db',
    valid: notEmpty(),
    help: <div>Name of the SQL database</div>,
  },
  driver: {
    type: 'OIbSelect',
    newRow: false,
    md: 2,
    options: ['mssql'],
    label: 'SQL Driver',
    defaultValue: 'mssql',
    help: <div>Driver SQL</div>,
  },
  username: {
    type: 'OIbText',
    defaultValue: '',
    valid: notEmpty(),
  },
  password: {
    newRow: false,
    type: 'OIbPassword',
    defaultValue: '',
    valid: notEmpty(),
  },
  query: {
    md: 8,
    type: 'OIbTextArea',
    defaultValue: '',
    valid: notEmpty(),
    help: <div>SQL query</div>,
  },
  connectionTimeout: {
    type: 'OIbInteger',
    valid: minValue(0),
    defaultValue: 1000,
  },
  requestTimeout: {
    type: 'OIbInteger',
    newRow: false,
    valid: minValue(0),
    defaultValue: 1000,
  },
  delimiter: {
    type: 'OIbText',
    defaultValue: ',',
    valid: notEmpty(),
    help: <div>Delimiter in the CSV file</div>,
  },
  dateFormat: {
    newRow: false,
    type: 'OIbText',
    defaultValue: 'YYYY-MM-DD HH:mm:ss.SSS',
    valid: notEmpty(),
    help: <div>Date Format</div>,
  },
  filename: {
    type: 'OIbText',
    newRow: false,
    defaultValue: 'sql-@date.csv',
    valid: notEmpty(),
    help: <div>The name of the CSV file</div>,
  },
  timeColumn: {
    type: 'OIbText',
    md: 2,
    defaultValue: 'timestamp',
    valid: notEmpty(),
    help: <div>Time Column</div>,
  },
  timezone: {
    type: 'OIbSelect',
    newRow: false,
    md: 2,
    defaultValue: 'Europe/Paris',
    help: <div>Time Zone</div>,
    options: [
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
    ],
  },
}
schema.points = null

export default schema
