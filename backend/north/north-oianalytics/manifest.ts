import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';
import Joi from 'joi';

const manifest: NorthConnectorManifest = {
  name: 'OIAnalytics',
  category: 'oi',
  description: 'OIAnalytics description',
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
    { key: 'proxy', type: 'OibProxy', label: 'Proxy', newRow: true },
    { key: 'authentication', type: 'OibAuthentication', label: 'Authentication', newRow: true, authTypes: ['none', 'basic'] }
  ],
  schema: Joi.object({
    host: Joi.string()
      .required()
      .uri({ scheme: ['http', 'https', 'HTTP', 'HTTPS'] }),
    proxy: Joi.string().optional(),
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
  })
};
export default manifest;
