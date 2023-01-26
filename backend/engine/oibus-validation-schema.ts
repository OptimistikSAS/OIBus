import Joi from "joi";

const scanModeSchema: Joi.ObjectSchema = Joi.object({});
const proxySchema: Joi.ObjectSchema = Joi.object({});
const externalSourceSchema: Joi.ObjectSchema = Joi.object({});
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
