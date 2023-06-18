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
  })
});
const ipFilterSchema: Joi.ObjectSchema = Joi.object({
  address: Joi.string().required(),
  description: Joi.string().required().allow(null, '')
});
const historyQuerySchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required().allow(null, ''),
  enabled: Joi.boolean(),
  startTime: Joi.date().required(),
  endTime: Joi.date().required(),
  southType: Joi.string().required().allow(null, ''),
  northType: Joi.string().required().allow(null, ''),
  southSettings: Joi.object().required(),
  northSettings: Joi.object().required(),
  caching: Joi.object().required(),
  archive: Joi.object().required()
});
const userSchema: Joi.ObjectSchema = Joi.object({
  login: Joi.string().required().min(4),
  firstName: Joi.optional(),
  lastName: Joi.optional(),
  email: Joi.optional(),
  language: Joi.string().required(),
  timezone: Joi.string().required()
});

const logSchema: Joi.ObjectSchema = Joi.object({
  streams: Joi.array().items(
    Joi.object({
      values: Joi.array().items(Joi.array().items(Joi.string())),
      stream: Joi.object({
        level: Joi.string(),
        oibus: Joi.string(),
        scope: Joi.string()
      })
    })
  )
});

export { scanModeSchema, proxySchema, externalSourceSchema, engineSchema, ipFilterSchema, userSchema, historyQuerySchema, logSchema };
