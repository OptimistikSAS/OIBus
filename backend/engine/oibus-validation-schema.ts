import Joi from "joi";

const logLevels: string[] = [
  "silent",
  "error",
  "warning",
  "info",
  "debug",
  "trace",
];
const authenticationTypes = ["none", "basic", "bearer", "api-key"];

const scanModeSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required().min(1),
  description: Joi.string().required().min(0).allow(null),
  cron: Joi.string().required().min(1),
});
const proxySchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required().min(1),
  description: Joi.string().required().min(0).allow(null),
  address: Joi.string().required().alphanum().min(1),
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
    console: Joi.options({
      level: Joi.string().required().allow(logLevels),
    }),
    file: Joi.object({
      level: Joi.string().required().allow(logLevels),
      maxFileSize: Joi.number().required().min(1),
      numberOfFiles: Joi.number().required().min(1),
    }),
    database: Joi.object({
      level: Joi.string().required().allow(logLevels),
      maxNumberOfLogs: Joi.number().required().min(100000),
    }),
    loki: Joi.object({
      level: Joi.string().required().allow(logLevels),
      interval: Joi.number().required().min(10),
      address: Joi.string().required().alphanum().min(1),
      tokenAddress: Joi.string().required().alphanum().min(1),
      username: Joi.string().required().min(0).allow(null),
      password: Joi.string().required().min(0).allow(null),
      proxyId: Joi.string().required().min(0).allow(null),
    }),
  }),
  healthSignal: Joi.object({
    logging: Joi.options({
      enabled: Joi.boolean().required(),
      interval: Joi.number().required().min(10),
    }),
    http: Joi.options({
      enabled: Joi.boolean().required(),
      interval: Joi.number().required().min(10),
      verbose: Joi.boolean().required(),
      address: Joi.string().required().alphanum().min(1),
      proxyId: Joi.string().required(),
      authentication: Joi.object({
        type: Joi.string().required().allow(authenticationTypes),
        key: Joi.string().required().min(0).allow(null),
        secret: Joi.string().required().min(0).allow(null),
      }),
    }),
  }),
});
const ipFilterSchema: Joi.ObjectSchema = Joi.object({
  address: Joi.string().required().alphanum().min(1),
  description: Joi.string().required().min(0).allow(null),
});

export {
  scanModeSchema,
  proxySchema,
  externalSourceSchema,
  engineSchema,
  ipFilterSchema,
};
