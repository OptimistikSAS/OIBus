import Joi from 'joi';

export default class JoiValidator {
  async validate(schema: Joi.ObjectSchema, dto: any): Promise<void> {
    await schema.validateAsync(dto, {
      abortEarly: false
    });
  }
}
