import React from 'react'
import { inRange, minValue, notEmpty, optional, startsWith } from '../../service/validation.service.js'

const schema = { name: 'RestApi' }
schema.form = {
  RestApiSettings: {
    type: 'OibTitle',
    label: 'REST API Network Settings',
    md: 12,
    children: (
      <p>
        Specify the protocol, the HTTP method to use, the host name (or ip address), the port to use and the endpoint to retrieve the data.
      </p>
    ),
  },
  protocol: {
    type: 'OibSelect',
    label: 'Protocol',
    options: ['http', 'https'],
    md: 1,
    defaultValue: 'http',
  },
  requestMethod: {
    type: 'OibSelect',
    label: 'Request Method',
    newRow: false,
    options: ['GET', 'POST', 'PUT', 'PATCH'],
    md: 1,
    defaultValue: 'GET',
  },
  host: {
    type: 'OibText',
    label: 'Host',
    newRow: false,
    md: 4,
    defaultValue: 'localhost',
    valid: notEmpty(),
    help: <div>IP address or host name of the API server</div>,
  },
  port: {
    type: 'OibInteger',
    label: 'Port',
    newRow: false,
    md: 1,
    valid: inRange(0, 65535),
    defaultValue: 80,
    help: <div>Port number of the API server</div>,
  },
  endpoint: {
    type: 'OibText',
    label: 'Endpoint',
    newRow: false,
    md: 4,
    valid: startsWith('/'),
    help: <div>Endpoint to request</div>,
  },
  authentication: { type: 'OibAuthentication', label: 'Authentication' },
  acceptSelfSigned: {
    type: 'OibCheckbox',
    label: 'Accept rejected certificates?',
    md: 2,
    defaultValue: false,
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
  querySettings: {
    type: 'OibTitle',
    label: 'Query Settings',
    md: 12,
    children: (
      <>
        <div>
          You can add query params directly from the table (key/value pairs), or enter a body in a json format.
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
          To prevent blocking if the HTTP server is not available or the query is faulty it is possible to configure
          separate connection timeout and request timeout.
        </p>
        <p>
          To avoid a heavy query on a server, the query can be split into several sub-queries.
          To do so, you can use the variables @StartTime and @EndTime.
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
  queryParams: {
    type: 'OibTable',
    rows: {
      queryParamKey: {
        type: 'OibText',
        label: 'Key',
        valid: notEmpty(),
        defaultValue: '',
      },
      queryParamValue: {
        type: 'OibText',
        label: 'Value',
        valid: notEmpty(),
        defaultValue: '',
      },
    },
    md: 6,
  },
  body: {
    md: 6,
    newRow: false,
    type: 'OibTextArea',
    label: 'Body',
    contentType: 'json',
    defaultValue: '',
    valid: optional(),
    help: <div>Available variables: @StartTime, @EndTime. See Query Settings help section.</div>,
  },
  variableDateFormat: {
    type: 'OibSelect',
    label: 'Variable Date Format',
    options: ['ISO', 'number'],
    md: 1,
    defaultValue: 'ISO',
  },
  fileSettings: {
    type: 'OibTitle',
    label: 'File Settings',
    md: 12,
    children: (
      <div>
        The query results are converted into a CSV file following the parser specified below.
        It is possible to specify the delimiter used in the CSV file, how to format the timestamp field and also
        the name of the file with a template.
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
    ),
  },
  payloadParser: {
    type: 'OibSelect',
    label: 'Payload parser',
    options: ['Raw', 'OIAnalytics time values', 'SLIMS'],
    md: 2,
    defaultValue: 'Raw',
  },
  convertToCsv: {
    type: 'OibCheckbox',
    label: 'Convert payload into CSV?',
    md: 2,
    defaultValue: true,
  },
  delimiter: {
    type: 'OibText',
    label: 'Delimiter',
    newRow: false,
    defaultValue: ',',
    valid: notEmpty(),
    help: <div>Delimiter in the CSV file</div>,
    md: 1,
  },
  fileName: {
    type: 'OibText',
    label: 'Filename',
    defaultValue: '@ConnectorName-results_@CurrentDate-@QueryPart.csv',
    valid: notEmpty(),
    help: <div>The name of the CSV file containing the results</div>,
    md: 3,
  },
  compression: {
    type: 'OibCheckbox',
    newRow: false,
    label: 'Compress File?',
    md: 2,
    defaultValue: false,
  },
}

schema.category = 'API'

export default schema
