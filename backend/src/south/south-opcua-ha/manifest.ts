import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';
import Joi from 'joi';

const manifest: SouthConnectorManifest = {
  name: 'OPCUA_HA',
  category: 'iot',
  description: 'OPCUA_HA description',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    historyPoint: true,
    historyFile: false
  },
  settings: [
    {
      key: 'url',
      type: 'OibText',
      label: 'URL',
      defaultValue: 'opc.tcp://servername:port/endpoint',
      newRow: true,
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|opc.tcp:\\/\\/).*' } }],
      readDisplay: true
    },
    {
      key: 'keepSessionAlive',
      type: 'OibCheckbox',
      label: 'Keep Session Alive',
      defaultValue: false,
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'readTimeout',
      type: 'OibNumber',
      label: 'Read timeout (ms)',
      defaultValue: 180_000,
      newRow: true,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      readDisplay: false
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval (ms)',
      defaultValue: 10_000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      readDisplay: false
    },
    {
      key: 'maxReadInterval',
      type: 'OibNumber',
      label: 'Max read interval (s)',
      defaultValue: 3600,
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: false
    },
    {
      key: 'readIntervalDelay',
      type: 'OibNumber',
      label: 'Read interval delay (ms)',
      defaultValue: 200,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      readDisplay: false
    },
    {
      key: 'maxReturnValues',
      type: 'OibNumber',
      label: 'Max return values',
      defaultValue: 1000,
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: false
    },
    {
      key: 'securityMode',
      type: 'OibSelect',
      label: 'Security Mode',
      options: ['None', 'Sign', 'SignAndEncrypt'],
      defaultValue: 'None',
      validators: [{ key: 'required' }],
      newRow: true,
      readDisplay: true
    },
    {
      key: 'securityPolicy',
      type: 'OibSelect',
      label: 'Security Policy',
      options: [
        'None',
        'Basic128',
        'Basic192',
        'Basic256',
        'Basic128Rsa15',
        'Basic192Rsa15',
        'Basic256Rsa15',
        'Basic256Sha256',
        'Aes128_Sha256_RsaOaep',
        'PubSub_Aes128_CTR',
        'PubSub_Aes256_CTR'
      ],
      defaultValue: 'None',
      conditionalDisplay: { securityMode: ['Sign', 'SignAndEncrypt'] },
      newRow: false,
      readDisplay: true
    },
    { key: 'authentication', type: 'OibAuthentication', label: 'Authentication', newRow: true, authTypes: ['none', 'basic', 'cert'] }
  ],
  schema: Joi.object({
    url: Joi.string()
      .required()
      .uri({ scheme: ['http', 'opc.tcp'] }),
    keepSessionAlive: Joi.boolean().required().falsy(0).truthy(1),
    readTimeout: Joi.number().integer().required().min(100).max(3_600_000),
    retryInterval: Joi.number().integer().required().min(100).max(3_600_000),
    maxReadInterval: Joi.number().integer().required(),
    readIntervalDelay: Joi.number().integer().required().min(100).max(3_600_000),
    maxReturnValues: Joi.number().integer().required(),
    username: Joi.string(),
    password: Joi.string(),
    securityMode: Joi.string().required().valid('None', 'Sign', 'SignAndEncrypt'),
    securityPolicy: Joi.string().valid(
      'None',
      'Basic128',
      'Basic192',
      'Basic256',
      'Basic128Rsa15',
      'Basic192Rsa15',
      'Basic256Rsa15',
      'Basic256Sha256',
      'Aes128_Sha256_RsaOaep',
      'PubSub_Aes128_CTR',
      'PubSub_Aes256_CTR'
    ),
    certFile: Joi.string().allow(''),
    keyFile: Joi.string().allow(''),
    authentication: Joi.object({
      type: Joi.string().required().allow('none', 'basic'),
      username: Joi.optional(),
      password: Joi.optional(),
      token: Joi.optional(),
      key: Joi.optional(),
      secret: Joi.optional(),
      certPath: Joi.optional(),
      keyPath: Joi.optional()
    }).required()
  }),
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'aggregate',
        type: 'OibSelect',
        label: 'Aggregate',
        options: ['Raw', 'Average', 'Minimum', 'Maximum', 'Count'],
        defaultValue: 'Raw',
        validators: [{ key: 'required' }],
        readDisplay: true
      },
      {
        key: 'resampling',
        type: 'OibSelect',
        label: 'Resampling',
        options: ['None', 'Second', '10 Seconds', '30 Seconds', 'Minute', 'Hour', 'Day'],
        defaultValue: 'None',
        readDisplay: true
      },
      {
        key: 'nodeId',
        type: 'OibText',
        label: 'Node ID',
        validators: [{ key: 'required' }],
        readDisplay: true
      }
    ],
    schema: Joi.object({
      aggregate: Joi.string().required().valid('Raw', 'Average', 'Minimum', 'Maximum', 'Count'),
      resampling: Joi.string().required().valid('None', 'Second', '10 Seconds', '30 Seconds', 'Minute', 'Hour', 'Day'),
      nodeId: Joi.string().required()
    })
  }
};
export default manifest;
