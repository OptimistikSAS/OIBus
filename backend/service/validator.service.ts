import { ipFilterSchema } from "../engine/oibus-validation-schema";
import IpFilterValidator from "../validators/ip-filter.validator";

export default class ValidatorService {
  private readonly _ipFilterValidator: IpFilterValidator;

  constructor() {
    this._ipFilterValidator = new IpFilterValidator(ipFilterSchema);
  }

  get ipFilterValidator(): IpFilterValidator {
    return this._ipFilterValidator;
  }
}
