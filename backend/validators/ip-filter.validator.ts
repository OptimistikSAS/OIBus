import { ipFilterSchema } from "../engine/oibus-validation-schema";
import { IpFilterCommandDTO } from "../model/ip-filter.model";

export default class IpFilterValidator {
  async validate(ipFilterCommandDTO: IpFilterCommandDTO): Promise<void> {
    await ipFilterSchema.validateAsync(ipFilterCommandDTO);
  }
}
