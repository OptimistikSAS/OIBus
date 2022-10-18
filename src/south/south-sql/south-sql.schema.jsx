import React from 'react'
import { notEmpty, isHost, inRange, minValue, hasLengthBetween, optional } from '../../service/validation.service'

const schema = { name: 'SQL' }
schema.form = {
  SQLSettings: {
    type: 'OibTitle',
    label: 'SQL Settings',
    md: 12,
    children: (
      <>
        <p>
          SQL periodically connects to the specified SQL server at an interval specified by scan mode.
          It gets values from the database based on the &apos;query&apos; parameter, saves the result in a CSV file
          and sends to any North capable of handling files and configured to accept files from this South.
        </p>
        <p>
          Note for Oracle:
          Oracle Client libraries must be installed and configured separated.
          {' '}
          <a href="https://oracle.github.io/node-oracledb/INSTALL.html" target="_blank" rel="noopener noreferrer">More info</a>
        </p>
        <p>
          Note for all SQL connections with username:
          To avoid accidental data deletion/alteration the SQL user should have only readonly access to the database.
        </p>
      </>
    ),
  },
  driver: {
    type: 'OibSelect',
    md: 2,
    options: ['mssql', 'mysql', 'postgresql', 'oracle', 'sqlite'],
    label: 'SQL Driver',
    defaultValue: 'mssql',
    help: <div>Driver SQL</div>,
  },
  databasePath: {
    type: 'OibText',
    defaultValue: './test.db',
    valid: optional(),
    help: <div>The path of the SQLite database</div>,
  },
  host: {
    type: 'OibText',
    defaultValue: 'localhost',
    valid: isHost(),
    help: <div>IP address of the SQL server</div>,
  },
  port: {
    type: 'OibInteger',
    newRow: false,
    md: 2,
    valid: inRange(0, 65535),
    defaultValue: 1433,
    help: <div>Port number of the SQL server</div>,
  },
  database: {
    type: 'OibText',
    defaultValue: 'db',
    md: 3,
    valid: notEmpty(),
    help: <div>Name of the SQL database (SID or Service Name for Oracle)</div>,
  },
  username: {
    type: 'OibText',
    defaultValue: '',
    valid: notEmpty(),
    help: <div>(Preferably with only readonly access to the database)</div>,
    md: 3,
  },
  password: {
    newRow: false,
    type: 'OibPassword',
    defaultValue: '',
    valid: hasLengthBetween(0, 256),
    md: 3,
  },
  domain: {
    newRow: false,
    type: 'OibText',
    valid: optional(),
    defaultValue: '',
    help: <div>(optional used for ntlm authentication for mssql</div>,
    md: 3,
  },
  encryption: {
    type: 'OibCheckbox',
    label: 'Encryption?',
    defaultValue: true,
    help: <div>Disable encryption for mssql if TLS 1.2 patch is not installed</div>,
    md: 2,
  },
  QuerySettings: {
    type: 'OibTitle',
    label: 'Query Settings',
    md: 12,
    children: (
      <>
        <div>
          The query must be adapted to the selected driver (MSSQL, Oracle...).
          The following variables can be used in the query:
          <ul>
            <li>
              <b>@StartTime:</b>
              {' '}
              The time of the previous query retrieved from the &apos;Time column&apos; field.
              For the first query, it is initialized to the current date.
              The date format can be adapted with driver specific functions.
              <br />
              For example, with sqlite, the following function can be used to parse the date as a string:
              <i> strftime(&apos;%Y-%m-%dT%H:%M:%f&apos;, @StartTime / 1000, &apos;unixepoch&apos;)</i>
            </li>
            <li>
              <b>@EndTime:</b>
              {' '}
              The current time (by default) or, if the query is split with &apos;Max read interval&apos;, the end time of the current interval.
            </li>
          </ul>
        </div>
        <p>
          To prevent blocking if the SQL server is not available or the query is faulty it is possible to configure
          separate connection timeout and request timeout (not available for sqlite).
        </p>
        <p>
          To avoid a heavy query on a server, the query can be split into several sub-queries.
          To do so, you can use the variables @StartTime and @EndTime.
          <br />
          If you request data with a column named timestamp, the WHERE clause can look like this :
          WHERE timestamp &gt; @StartTime and timestamp &lt; @EndTime.
        </p>
        <p>
          @StartTime is set to the last retrieved value (retrieved from the &apos;Time column&apos; field),
          and @EndTime is set to @StartTime + maxReadInterval (if @StartTime + maxReadInterval &lt; current date).
          @StartTime is then incremented at each sub-query until @EndTime reaches the current date.
          Each sub-query stores its results in its own csv file. See the File Settings help section below for more information.
        </p>
        <p>
          Note for Oracle:
          Connection timeout can be specified in the &apos;sqlnet.ora&apos; file (E.g. in /opt/oracle/instantclient_19_5/network/admin/sqlnet.ora)
          like this: &apos;SQLNET.OUTBOUND_CONNECT_TIMEOUT=500 ms&apos;
        </p>
      </>
    ),
  },
  query: {
    md: 12,
    type: 'OibTextArea',
    contentType: 'sql',
    defaultValue: 'SELECT * FROM Table WHERE timestamp > @StartTime',
    valid: notEmpty(),
    help: <div>Available variables: @StartTime, @EndTime. See Query Settings help section.</div>,
  },
  connectionTimeout: {
    type: 'OibInteger',
    label: 'Connection timeout (ms)',
    valid: minValue(0),
    defaultValue: 1000,
    md: 2,
  },
  requestTimeout: {
    type: 'OibInteger',
    label: 'Request timeout (ms)',
    newRow: false,
    valid: minValue(0),
    defaultValue: 1000,
    md: 2,
  },
  maxReadInterval: {
    type: 'OibInteger',
    label: 'Max read interval (s)',
    md: 2,
    valid: minValue(0),
    defaultValue: 0,
    help: <div>Split the time interval into smaller intervals of this duration (in s). 0 to not split the query.</div>,
  },
  readIntervalDelay: {
    type: 'OibInteger',
    label: 'Read interval delay (ms)',
    newRow: false,
    md: 2,
    valid: minValue(0),
    defaultValue: 200,
    help: <div>Time to wait between the read interval iterations (ms)</div>,
  },
  FileSettings: {
    type: 'OibTitle',
    label: 'File Settings',
    md: 12,
    children: (
      <>
        <div>
          The query results are converted into a CSV file. It is possible to specify the delimiter used in the CSV file, how to format
          the timestamp field and also the name of the file with a template.
          <p>The file name can be adapted with the following variables: </p>
          <ul>
            <li>
              <b>@CurrentDate:</b>
              {' '}
              The date the file is created. The date format is yyyy_MM_dd_HH_mm_ss_SSS
            </li>
            <li>
              <b>@ConnectorName:</b>
              {' '}
              The name of the south connector
            </li>
            <li>
              <b>@QueryPart:</b>
              {' '}
              When the query is split according the the MaxReadInterval field, we can use the @QueryPart parameter to name the file.
              If the query is not split, @QueryPart is replaced by 0
            </li>
          </ul>
        </div>
        <p>
          Since we have no information about the SQL server timezone it is possible to specify the time column and the timezone for it.
        </p>
        <p>
          All date fields are read as UTC time and converted to the specified timezone.
          Ex: With timezone &apos;Europe/Paris&apos; the date &apos;2019-01-01 00:00:00&apos;
          will be converted to &apos;Tue Jan 01 2019 00:00:00 GMT+0100&apos;
        </p>
      </>
    ),
  },
  filename: {
    type: 'OibText',
    defaultValue: 'sql-@CurrentDate.csv',
    valid: notEmpty(),
    help: <div>The name of the CSV file. Available variables: @CurrentDate, @ConnectorName, @QueryPart</div>,
    md: 3,
  },
  compression: {
    type: 'OibCheckbox',
    newRow: false,
    label: 'Compress File?',
    md: 2,
    defaultValue: false,
  },
  delimiter: {
    type: 'OibText',
    defaultValue: ',',
    valid: notEmpty(),
    help: <div>Delimiter in the CSV file</div>,
    md: 1,
  },
  dateFormat: {
    newRow: false,
    type: 'OibText',
    defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
    valid: notEmpty(),
    md: 2,
  },
  timeColumn: {
    newRow: false,
    type: 'OibText',
    md: 2,
    defaultValue: 'timestamp',
    valid: notEmpty(),
  },
  timezone: {
    type: 'OibTimezone',
    newRow: false,
    md: 2,
  },
}

schema.withDriver = (driver) => {
  schema.form.domain.hidden = driver !== 'mssql'
  schema.form.databasePath.hidden = driver !== 'sqlite'
  schema.form.database.hidden = driver === 'sqlite'
  schema.form.host.hidden = driver === 'sqlite'
  schema.form.port.hidden = driver === 'sqlite'
  schema.form.username.hidden = driver === 'sqlite'
  schema.form.password.hidden = driver === 'sqlite'
  schema.form.requestTimeout.hidden = driver === 'sqlite'
  schema.form.connectionTimeout.hidden = driver === 'sqlite'
  return schema
}

schema.category = 'DatabaseOut'

export default schema
