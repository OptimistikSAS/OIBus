import { IpFilterCommandDTO } from "../model/ip-filter.model";
import Joi from "joi";

export default class IpFilterValidator {
  constructor(private readonly ipFilterSchema: Joi.ObjectSchema) {}

  async validate(ipFilterCommandDTO: IpFilterCommandDTO): Promise<void> {
    await this.ipFilterSchema.validateAsync(ipFilterCommandDTO);
  }
}
