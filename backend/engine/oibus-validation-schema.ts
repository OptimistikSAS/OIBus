import Joi from "joi";

const scanModeSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required().min(1),
  description: Joi.string().required().min(0).allow(null),
  cron: Joi.string().required().min(1),
});
const proxySchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required().min(1),
  description: Joi.string().required().min(0).allow(null),
  address: Joi.string().required().min(1),
  username: Joi.string().required().min(0).allow(null),
  password: Joi.string().required().min(0).allow(null),
});
const externalSourceSchema: Joi.ObjectSchema = Joi.object({
  reference: Joi.string().required().min(1),
  description: Joi.string().required().min(0).allow(null),
});
const engineSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required().min(1),
  port: Joi.number().required().port(),
  logParameters: Joi.object({
    console: Joi.object({
      level: Joi.string()
        .required()
        .allow("silent", "error", "warning", "info", "debug", "trace"),
    }),
    file: Joi.object({
      level: Joi.string()
        .required()
        .allow("silent", "error", "warning", "info", "debug", "trace"),
      maxFileSize: Joi.number().required().min(1),
      numberOfFiles: Joi.number().required().min(1),
    }),
    database: Joi.object({
      level: Joi.string()
        .required()
        .allow("silent", "error", "warning", "info", "debug", "trace"),
      maxNumberOfLogs: Joi.number().required().min(100_000),
    }),
    loki: Joi.object({
      level: Joi.string()
        .required()
        .allow("silent", "error", "warning", "info", "debug", "trace"),
      interval: Joi.number().required().min(10),
      address: Joi.string().required().min(0),
      tokenAddress: Joi.string().required().min(0),
      username: Joi.string().required().min(0),
      password: Joi.string().required().min(0),
      proxyId: Joi.string().required().min(0).allow(null),
    }),
  }),
  healthSignal: Joi.object({
    logging: Joi.object({
      enabled: Joi.boolean().required(),
      interval: Joi.number().required().min(10),
    }),
    http: Joi.object({
      enabled: Joi.boolean().required(),
      interval: Joi.number().required().min(10),
      verbose: Joi.boolean().required(),
      address: Joi.string().required().min(0),
      proxyId: Joi.string().required().min(0).allow(null),
      authentication: Joi.object({
        type: Joi.string()
          .required()
          .allow("none", "basic", "bearer", "api-key"),
        key: Joi.string().required().min(0),
        secret: Joi.string().required().min(0),
      }),
    }),
  }),
});
const ipFilterSchema: Joi.ObjectSchema = Joi.object({
  address: Joi.string().required().min(1),
  description: Joi.string().required().min(0).allow(null),
});

export {
  scanModeSchema,
  proxySchema,
  externalSourceSchema,
  engineSchema,
  ipFilterSchema,
};
