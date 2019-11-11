import React from 'react'
import { notEmpty, inRange, minValue } from '../../services/validation.service.js'

const schema = { name: 'SQLDbToFile' }
schema.form = {
  SQLDBtoFileSettings: {
    type: 'OIbTitle',
    help: <p>todo</p>,
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
    valid: inRange(0, 65535),
    defaultValue: 1433,
    help: <div>Port number of the SQLDbToFile server</div>,
  },
  driver: {
    type: 'OIbSelect',
    options: ['mssql'],
    label: 'SQL Driver',
    valid: notEmpty(),
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
  database: {
    type: 'OIbText',
    defaultValue: 'db',
    valid: notEmpty(),
    help: <div>Name of the SQL database</div>,
  },
  query: {
    md: 12,
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
    help: <div>delimiter</div>,
  },
  filename: {
    type: 'OIbText',
    defaultValue: 'sql-@date.csv',
    valid: notEmpty(),
    help: <div>delimiter</div>,
  },
  scanMode: { type: 'OIbScanMode' },
  timeColumn: {
    type: 'OIbText',
    defaultValue: 'timestamp',
    valid: notEmpty(),
    help: <div>Time Column</div>,
  },
  timeFormat: {
    newRow: false,
    type: 'OIbText',
    defaultValue: 'YYYY-MM-DD HH:mm:ss.SSS',
    valid: notEmpty(),
    help: <div>Time Format</div>,
  },
  timeZone: {
    newRow: false,
    type: 'OIbText',
    valid: notEmpty(),
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
