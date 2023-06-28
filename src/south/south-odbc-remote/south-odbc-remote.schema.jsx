import React from 'react'
import { notEmpty, minValue } from '../../service/validation.service.js'
import manifest from './manifest.js'

const schema = { ...manifest }
schema.form = {
  SQLSettings: {
    type: 'OibTitle',
    label: 'SQL Settings',
    md: 12,
    children: (
      <p>
        ODBC remote is a south connector destined to be used with the ODBC Windows Agent that will used ODBC libraries to
        connect with the ODBC data source.
        It interacts with this agent using http Rest API to send command and retrieve results.
      </p>
    ),
  },
  connectionString: {
    newRow: false,
    type: 'OibText',
    label: 'ODBC connection string',
    defaultValue: '',
    valid: notEmpty(),
    help: <div>The connection string to use for ODBC connection</div>,
  },
  agentUrl: {
    type: 'OibText',
    label: 'Agent url',
    defaultValue: 'http://ip-adress-or-host:2224',
    valid: notEmpty(),
    help: <div>The url of the remote agent</div>,
  },
  QuerySettings: {
    type: 'OibTitle',
    label: 'Query Settings',
    md: 12,
    children: (
      <>
        <div>
          The query to execute on the odbc data source.
          The following variables can be used in the query:
          <ul>
            <li>
              <b>@StartTime:</b>
              {' '}
              The time of the previous query retrieved from the &apos;Time column&apos; field.
              For the first query, it is initialized to the current date.
            </li>
            <li>
              <b>@EndTime:</b>
              {' '}
              The current time (by default) or, if the query is split with &apos;Max read interval&apos;, the end time of the current interval.
            </li>
          </ul>
        </div>
        <p>
          To prevent blocking if the ODBC data source is not available or the query is faulty it is possible to configure
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
      </>
    ),
  },
  query: {
    md: 12,
    type: 'OibTextArea',
    label: 'Query',
    contentType: 'sql',
    defaultValue: 'SELECT * FROM Table WHERE timestamp > @StartTime',
    valid: notEmpty(),
    help: <div>Available variables: @StartTime, @EndTime. See Query Settings help section.</div>,
  },
  timeColumn: {
    newRow: false,
    label: 'Time column',
    type: 'OibText',
    md: 2,
    defaultValue: 'timestamp',
    valid: notEmpty(),
  },
  datasourceTimestampFormat: {
    newRow: false,
    label: 'Datasource timestamp format',
    type: 'OibText',
    defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
    valid: notEmpty(),
    md: 2,
  },
  datasourceTimezone: {
    type: 'OibTimezone',
    label: 'Datasource Timezone',
    newRow: false,
    md: 2,
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
    label: 'Filename',
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
    label: 'Delimiter',
    defaultValue: ',',
    valid: notEmpty(),
    help: <div>Delimiter in the CSV file</div>,
    md: 1,
  },
  outputTimestampFormat: {
    newRow: false,
    label: 'Output timestamp format',
    type: 'OibText',
    defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
    valid: notEmpty(),
    md: 2,
  },
  outputTimezone: {
    type: 'OibTimezone',
    label: 'Output Timezone',
    newRow: false,
    md: 2,
  },
}

export default schema
