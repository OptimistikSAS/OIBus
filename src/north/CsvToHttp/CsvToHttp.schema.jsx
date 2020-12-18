import React from 'react'
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
            Host url: url which will be used in order to send the csv file converted into a http request.
          </li>
          <li>
            Request Method: method wich will be used in the http request.
          </li>
          <li>
            Max Length of the body: number of object send in one request. If the number of rows in the csv file
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
          The csv file sent will be converted row by row into an http request. It is necessary to configure the mapping parameters in order to convert
          the wanted csv headers into a http request. The key of the wanted csv headers can be renamed.
        </p>
        <ul>
          <li>
            Csv delimiter: this delimiter will be used to parse your csv file.
          </li>
          <li>
            Name in csv file: key to be converted.
          </li>
          <li>
            Name in http request: the new name of the key.
          </li>
          <li>
            Type: the wanted type for you data (by default it is a string). Every data will be send as a string if the converted method fails.
          </li>
        </ul>
        <p>
          The unselected keys will be omitted during the mapping.
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

export default schema
