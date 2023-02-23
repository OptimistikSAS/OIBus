import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';
import Joi from 'joi';

const manifest: SouthConnectorManifest = {
  name: 'MQTT',
  category: 'iot',
  description: 'MQTT description',
  modes: {
    subscription: true,
    lastPoint: false,
    lastFile: false,
    historyPoint: false,
    historyFile: false
  },
  settings: [
    {
      key: 'url',
      type: 'OibText',
      label: 'URL',
      defaultValue: '',
      newRow: true,
      validators: [
        { key: 'required' },
        { key: 'pattern', params: { pattern: '^(mqtt:\\/\\/|mqtts:\\/\\/|tcp:\\/\\/|tls:\\/\\/|ws:\\/\\/|wss:\\/\\/).*' } }
      ],
      readDisplay: true
    },
    {
      key: 'qos',
      type: 'OibSelect',
      options: ['0', '1', '2'],
      label: 'QoS',
      defaultValue: '1',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'persistent',
      type: 'OibCheckbox',
      label: 'Persistent',
      defaultValue: false,
      newRow: false,
      conditionalDisplay: { qos: [2] },
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'username',
      type: 'OibText',
      label: 'Username',
      defaultValue: '',
      newRow: true,
      readDisplay: false
    },
    {
      key: 'password',
      type: 'OibSecret',
      label: 'Password',
      defaultValue: '',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'certFile',
      type: 'OibText',
      label: 'Cert File',
      defaultValue: '',
      newRow: true,
      readDisplay: false
    },
    {
      key: 'keyFile',
      type: 'OibText',
      label: 'Key File',
      defaultValue: '',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'caFile',
      type: 'OibText',
      label: 'CA File',
      defaultValue: '',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'rejectUnauthorized',
      type: 'OibCheckbox',
      label: 'Reject Unauthorized Connection',
      defaultValue: false,
      newRow: false,
      readDisplay: false,
      validators: [{ key: 'required' }]
    },
    {
      key: 'keepAlive',
      type: 'OibNumber',
      label: 'Keep Alive Interval (ms)',
      defaultValue: 60000,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      newRow: true,
      readDisplay: false
    },
    {
      key: 'reconnectPeriod',
      type: 'OibNumber',
      label: 'Reconnect period (ms)',
      defaultValue: 1000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }],
      readDisplay: false
    },
    {
      key: 'connectTimeout',
      type: 'OibNumber',
      label: 'Connect Timeout (ms)',
      defaultValue: 30000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }],
      readDisplay: false
    },
    {
      key: 'dataArrayPath',
      type: 'OibText',
      label: 'Data array path',
      newRow: true,
      readDisplay: false
    },
    {
      key: 'valuePath',
      type: 'OibText',
      label: 'Value path',
      defaultValue: 'value',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'pointIdPath',
      type: 'OibText',
      label: 'Point ID path',
      defaultValue: '',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'qualityPath',
      type: 'OibText',
      label: 'Quality path',
      defaultValue: 'quality',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'timestampOrigin',
      type: 'OibSelect',
      label: 'Timestamp origin',
      options: ['payload', 'oibus'],
      defaultValue: 'oibus',
      validators: [{ key: 'required' }],
      newRow: true,
      readDisplay: false
    },
    {
      key: 'timestampPath',
      type: 'OibText',
      label: 'Timestamp path',
      defaultValue: 'timestamp',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'timestampFormat',
      type: 'OibText',
      label: 'Timestamp format',
      defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'timestampTimezone',
      type: 'OibTimezone',
      label: 'Timestamp timezone',
      newRow: false,
      readDisplay: false
    }
  ],
  schema: Joi.object({
    url: Joi.string()
      .required()
      .uri({ scheme: ['mqtt', 'mqtts', 'tcp', 'tls', 'ws', 'wss'] }),
    qos: Joi.string().required().valid('0', '1', '2'),
    persistent: Joi.boolean().falsy(0).truthy(1).when('qos', { is: '2', then: Joi.required() }),
    username: Joi.string().allow(''),
    password: Joi.string().allow(''),
    certFile: Joi.string().allow(''),
    keyFile: Joi.string().allow(''),
    caFile: Joi.string().allow(''),
    rejectUnauthorized: Joi.boolean().required().falsy(0).truthy(1),
    keepAlive: Joi.number().integer().required().min(100).max(3_600_000),
    reconnectPeriod: Joi.number().integer().required().min(100).max(30_000),
    connectTimeout: Joi.number().integer().required().min(100).max(30_000),
    dataArrayPath: Joi.string(),
    valuePath: Joi.string().allow(''),
    pointIdPath: Joi.string().allow(''),
    qualityPath: Joi.string().allow(''),
    timestampOrigin: Joi.string().required().valid('payload', 'oibus'),
    timestampPath: Joi.string().allow(''),
    timestampFormat: Joi.string().allow(''),
    timestampTimezone: Joi.string().allow('')
  }),
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: true
    },
    settings: [
      {
        key: 'topic',
        type: 'OibText',
        label: 'Topic',
        validators: [{ key: 'required' }],
        readDisplay: true
      }
    ],
    schema: Joi.object({
      topic: Joi.string().required()
    })
  }
};
export default manifest;
