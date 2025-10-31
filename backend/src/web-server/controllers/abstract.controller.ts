import { Controller } from 'tsoa';
import JoiValidator from './validators/joi.validator';
import Joi from 'joi';

export default abstract class AbstractController extends Controller {
  constructor(
    protected readonly validator: JoiValidator,
    protected readonly schema: Joi.ObjectSchema
  ) {
    super();
  }

  protected async validate(dto: any): Promise<void> {
    await this.validator.validate(this.schema, dto);
  }
}
