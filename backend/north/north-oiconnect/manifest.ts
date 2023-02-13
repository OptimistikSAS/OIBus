import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';
import Joi from 'joi';

const manifest: NorthConnectorManifest = {
  name: 'OIConnect',
  category: 'oi',
  description: 'OIConnect description',
  modes: {
    files: true,
    points: true
  },
  settings: [
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
      readDisplay: true
    },
    {
      key: 'valuesEndpoint',
      type: 'OibText',
      label: 'Values endpoint',
      defaultValue: '/engine/addValues',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'fileEndpoint',
      type: 'OibText',
      label: 'File endpoint',
      defaultValue: '/engine/addFile',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    { key: 'proxy', type: 'OibProxy', label: 'Proxy', newRow: true }
  ],
  schema: Joi.object({
    host: Joi.string()
      .required()
      .uri({ scheme: ['http', 'https', 'HTTP', 'HTTPS'] }),
    valuesEndpoint: Joi.string().required(),
    fileEndpoint: Joi.string().required()
  })
};

export default manifest;
