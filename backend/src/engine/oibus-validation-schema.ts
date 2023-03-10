import Joi from 'joi';

const scanModeSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required().allow(null, ''),
  cron: Joi.string().required()
});
const proxySchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required().allow(null, ''),
  address: Joi.string().required(),
  username: Joi.string().required().allow(null, ''),
  password: Joi.string().required().allow(null, '')
});
const externalSourceSchema: Joi.ObjectSchema = Joi.object({
  reference: Joi.string().required(),
  description: Joi.string().required().allow(null, '')
});
const engineSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required(),
  port: Joi.number().required().port(),
  logParameters: Joi.object({
    console: Joi.object({
      level: Joi.string().required().allow('silent', 'error', 'warning', 'info', 'debug', 'trace')
    }),
    file: Joi.object({
      level: Joi.string().required().allow('silent', 'error', 'warning', 'info', 'debug', 'trace'),
      maxFileSize: Joi.number().integer().required().min(1),
      numberOfFiles: Joi.number().integer().required().min(1)
    }),
    database: Joi.object({
      level: Joi.string().required().allow('silent', 'error', 'warning', 'info', 'debug', 'trace'),
      maxNumberOfLogs: Joi.number().integer().required().min(100_000)
    }),
    loki: Joi.object({
      level: Joi.string().required().allow('silent', 'error', 'warning', 'info', 'debug', 'trace'),
      interval: Joi.number().integer().required().min(10),
      address: Joi.string().required().allow(''),
      tokenAddress: Joi.string().required().allow(''),
      username: Joi.string().required().allow(''),
      password: Joi.string().required().allow(''),
      proxyId: Joi.string().required().allow(null, '')
    })
  }),
  healthSignal: Joi.object({
    logging: Joi.object({
      enabled: Joi.boolean().required().falsy(0).truthy(1),
      interval: Joi.number().integer().required().min(10)
    }),
    http: Joi.object({
      enabled: Joi.boolean().required().falsy(0).truthy(1),
      interval: Joi.number().integer().required().min(10),
      verbose: Joi.boolean().required().falsy(0).truthy(1),
      address: Joi.string().required().allow(''),
      proxyId: Joi.string().required().allow(null, ''),
      authentication: Joi.object({
        type: Joi.string().required().allow('none', 'basic', 'bearer', 'api-key'),
        username: Joi.optional(),
        password: Joi.optional(),
        token: Joi.optional(),
        key: Joi.optional(),
        secret: Joi.optional(),
        certPath: Joi.optional(),
        keyPath: Joi.optional()
      }).required()
    })
  })
});
const ipFilterSchema: Joi.ObjectSchema = Joi.object({
  address: Joi.string().required(),
  description: Joi.string().required().allow(null, '')
});
const userSchema: Joi.ObjectSchema = Joi.object({
  login: Joi.string().required().min(4),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  email: Joi.string().optional(),
  language: Joi.string().required(),
  timezone: Joi.string().required()
});

export { scanModeSchema, proxySchema, externalSourceSchema, engineSchema, ipFilterSchema, userSchema };
