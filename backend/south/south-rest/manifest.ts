import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';
import Joi from 'joi';

const manifest: SouthConnectorManifest = {
  name: 'RestApi',
  category: 'api',
  description: 'REST description',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    historyPoint: false,
    historyFile: true
  },
  settings: [
    {
      key: 'url',
      type: 'OibText',
      label: 'URL',
      defaultValue: 'http://localhost',
      newRow: true,
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
      readDisplay: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 80,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }]
    },
    {
      key: 'requestMethod',
      type: 'OibSelect',
      options: ['GET', 'POST', 'PUT', 'PATCH'],
      label: 'HTTP Method',
      defaultValue: 'GET',
      newRow: false,
      validators: [{ key: 'required' }]
    },
    {
      key: 'acceptSelfSigned',
      type: 'OibCheckbox',
      label: 'Accept rejected certificates?',
      defaultValue: false,
      newRow: false,
      validators: [{ key: 'required' }],
      class: 'col-2'
    },
    {
      key: 'connectionTimeout',
      type: 'OibNumber',
      label: 'Connection timeout (ms)',
      defaultValue: 1000,
      newRow: true,
      class: 'col-2',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }]
    }
  ],
  schema: Joi.object({
    url: Joi.string()
      .required()
      .uri({ scheme: ['http', 'https', 'HTTP', 'HTTPS'] }),
    port: Joi.number().required().port(),
    requestMethod: Joi.string().required().valid('GET', 'POST', 'PUT', 'PATCH'),
    acceptSelfSigned: Joi.boolean().required().falsy(0).truthy(1),
    connectionTimeout: Joi.number().integer().required().min(100).max(30_000)
  }),
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'requestTimeout',
        type: 'OibNumber',
        label: 'Request timeout (ms)',
        defaultValue: 1000,
        newRow: false,
        class: 'col-2',
        validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 60_000 } }]
      },
      {
        key: 'maxReadInterval',
        type: 'OibNumber',
        label: 'Max read interval (s)',
        defaultValue: 0,
        newRow: true,
        class: 'col-2',
        validators: [{ key: 'required' }]
      },
      {
        key: 'readIntervalDelay',
        type: 'OibNumber',
        label: 'Read interval delay (ms)',
        defaultValue: 200,
        newRow: false,
        class: 'col-2',
        validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }]
      },
      {
        key: 'body',
        type: 'OibCodeBlock',
        label: 'Body',
        contentType: 'json',
        defaultValue: '',
        newRow: false
      },
      {
        key: 'variableDateFormat',
        type: 'OibSelect',
        label: 'Variable Date Format',
        options: ['ISO', 'number'],
        defaultValue: 'ISO',
        newRow: true,
        validators: [{ key: 'required' }]
      },
      {
        key: 'payloadParser',
        type: 'OibSelect',
        label: 'Payload parser',
        options: ['Raw', 'OIAnalytics time values', 'SLIMS'],
        defaultValue: 'Raw',
        newRow: true,
        validators: [{ key: 'required' }]
      },
      {
        key: 'convertToCsv',
        type: 'OibCheckbox',
        label: 'Convert payload into CSV?',
        defaultValue: true,
        newRow: true,
        validators: [{ key: 'required' }]
      },
      {
        key: 'delimiter',
        type: 'OibSelect',
        options: [',', ';', '|'],
        label: 'Delimiter',
        defaultValue: ',',
        newRow: false,
        validators: [{ key: 'required' }]
      },
      {
        key: 'filename',
        type: 'OibText',
        label: 'Filename',
        defaultValue: '@ConnectorName-results_@CurrentDate-@QueryPart.csv',
        validators: [{ key: 'required' }]
      },
      {
        key: 'compression',
        type: 'OibCheckbox',
        label: 'Compress File?',
        defaultValue: false,
        newRow: false,
        validators: [{ key: 'required' }]
      }
    ],
    schema: Joi.object({
      requestTimeout: Joi.number().integer().required().min(100).max(60_000),
      maxReadInterval: Joi.number().integer().required(),
      readIntervalDelay: Joi.number().integer().required().min(100).max(3_600_000),
      body: Joi.string(),
      variableDateFormat: Joi.string().required().valid('ISO', 'number'),
      payloadParser: Joi.string().required().valid('Raw', 'OIAnalytics time values', 'SLIMS'),
      convertToCsv: Joi.boolean().required().falsy(0).truthy(1),
      delimiter: Joi.string().required().valid(',', ';', '|'),
      filename: Joi.string().required(),
      compression: Joi.boolean().required().falsy(0).truthy(1)
    })
  }
};

export default manifest;
