import Joi from "joi";

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
const engineSchema: Joi.ObjectSchema = Joi.object({});
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
