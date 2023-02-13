import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';
import Joi from 'joi';

const manifest: NorthConnectorManifest = {
  name: 'WATSY',
  category: 'api',
  description: 'WATSY description',
  modes: {
    files: false,
    points: true
  },
  settings: [
    {
      key: 'MQTTUrl',
      type: 'OibText',
      label: 'MQTT URL',
      newRow: true,
      validators: [
        { key: 'required' },
        { key: 'pattern', params: { pattern: '^(mqtt:\\/\\/|mqtts:\\/\\/|tcp:\\/\\/|tls:\\/\\/|ws:\\/\\/|wss:\\/\\/).*' } }
      ],
      readDisplay: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 1883,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
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
      key: 'applicativeHostUrl',
      type: 'OibText',
      label: 'Applicative Host URL',
      defaultValue: '',
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
      readDisplay: true
    },
    {
      key: 'secretKey',
      type: 'OibSecret',
      label: 'Token',
      newRow: false,
      validators: [
        { key: 'minLength', params: { minLength: 1 } },
        { key: 'maxLength', params: { maxLength: 255 } }
      ],
      defaultValue: ''
    }
  ],
  schema: Joi.object({
    MQTTUrl: Joi.string()
      .required()
      .uri({ scheme: ['mqtt', 'mqtts', 'tcp', 'tls', 'ws', 'wss'] }),
    port: Joi.number().required().min(1).max(65535),
    username: Joi.string().allow(''),
    password: Joi.string().allow(''),
    applicativeHostUrl: Joi.string()
      .required()
      .uri({ scheme: ['http', 'https', 'HTTP', 'HTTPS'] }),
    secretKey: Joi.string().required().min(1).max(255)
  })
};

export default manifest;
