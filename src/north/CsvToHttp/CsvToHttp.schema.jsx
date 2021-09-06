import React from 'react'
import CsvToHttp from './file-in.png'
import { notEmpty, inRange } from '../../services/validation.service'

const schema = { name: 'CsvToHttp' }

schema.form = {
  WebParameters: {
    type: 'OIbTitle',
    label: 'Http Endpoint Parameters',
    children: (
      <div>
        <p>
          The aim of this North is to send a batch of converted value into a request.
          This number of value in this bacth can be defined by choosing the max length of the body.
        </p>
        <ul>
          <li>
            Host url: url which will be used in order to send the CSV file converted into a http request.
          </li>
          <li>
            Request Method: method wich will be used in the http request.
          </li>
          <li>
            Max Length of the body: number of object send in one request. If the number of rows in the CSV file
            is bigger, we will split in different requests.
          </li>
        </ul>
      </div>
    ),
  },
  applicativeHostUrl: {
    label: 'Host url',
    type: 'OIbLink',
    protocols: ['http', 'https'],
    defaultValue: '',
  },
  requestMethod: {
    type: 'OIbSelect',
    newRow: false,
    options: ['POST', 'PUT', 'PATCH'],
    md: 3,
    defaultValue: 'POST',
  },
  bodyMaxLength: {
    label: 'Max Length of the body',
    type: 'OIbInteger',
    newRow: false,
    valid: inRange(1, 10000),
    defaultValue: 100,
  },
  acceptUnconvertedRows: {
    type: 'OIbCheckBox',
    md: 2,
    newRow: true,
    defaultValue: true,
  },
  authentication: { type: 'OIbAuthentication' },
  CsvToHttpParameters: {
    type: 'OIbTitle',
    label: 'Mapping Parameters',
    children: (
      <div>
        <p>
          The CSV file sent will be converted row by row into an http request. It is necessary to configure the mapping parameters in order to convert
          the wanted CSV headers into a http request. The key of the wanted CSV headers can be renamed.
        </p>
        <ul>
          <li>
            CSV delimiter: this delimiter will be used to parse your CSV file.
          </li>
          <li>
            Header in CSV file: key to be converted.
          </li>
          <li>
            Field in http request(body): the new name of the key.
          </li>
          <li>
            Type: the wanted type for you data (by default it is a string). Every data will be send as a string if the converted method fails.
          </li>
        </ul>
        <p>
          The unselected keys will be omitted during the mapping.
        </p>
        <p>
          <b>Example 1: </b>
          If the CSV file contains 2 headers called header1 and header2, it is possible to specify the name for each field in the
          http request. It&lsquo;s possible to have in the body of the request a field called &quot;AfterMapping&quot;
          which contains the value of the header1 for each row. We can do the same for each header present in the CSV file
        </p>
        <p>
          <b>Example 2: </b>
          It is possible to specify the name for each header in the http request using template string
          (references to other headers as a variable). Thanks to it we can reference headers present in the CSV file as variables.
          For it, the syntax to use is the javascript one (such as: $
          {'{name of your header}'}
          ).
          With the same CSV file, it is possible to have in the request&lsquo;s body a field called myNewHeader its value is the
          concatenation of both header&lsquo;s value.
          The &quot;Header in CSV file&quot; must be filled with the value: $
          {'{header1} and {header2}'}
          . If a row has &lsquo;value1&lsquo; in the column &lsquo;header1&lsquo; and &lsquo;value2&lsquo; in the column &lsquo;header2&lsquo;, the
          resulting value will be &lsquo;value1 and value2&lsquo;.
        </p>
      </div>
    ),
  },
  csvDelimiter: {
    type: 'OIbSelect',
    newRow: false,
    options: [',', ';'],
    md: 3,
    defaultValue: ';',
  },
  mapping: {
    type: 'OIbTable',
    rows: {
      csvField: {
        type: 'OIbText',
        newRow: false,
        label: 'Header in csv file',
        valid: notEmpty(),
        defaultValue: '',
      },
      httpField: {
        type: 'OIbText',
        newRow: false,
        label: 'Field in http body',
        valid: notEmpty(),
        defaultValue: '',
      },
      type: {
        type: 'OIbSelect',
        newRow: false,
        label: 'Type',
        options: ['string', 'integer', 'float', 'timestamp', 'date (ISO)', 'short date (yyyy-mm-dd)'],
        md: 3,
        defaultValue: 'string',
      },
    },
  },
  networkSection: {
    type: 'OIbTitle',
    label: 'Network',
    children: (
      <>
        <p>Please specify here the proxy name to use</p>
        <p>(proxy names are defined in the Engine page)</p>
      </>
    ),
  },
  proxy: { type: 'OIbProxy' },
}
schema.image = CsvToHttp
export default schema
