import Joi from "joi";
import ValidatorInterface from "./validator.interface";

export default class JoiValidator implements ValidatorInterface {
  constructor(private readonly schema: Joi.ObjectSchema) {}

  async validate(dto: any): Promise<void> {
    await this.schema.validateAsync(dto, {
      abortEarly: false,
    });
  }
}
