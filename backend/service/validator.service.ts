import {
  scanModeSchema,
  proxySchema,
  externalSourceSchema,
  engineSchema,
  ipFilterSchema,
} from "../engine/oibus-validation-schema";
import JoiValidator from "../validators/joi.validator";
import ValidatorInterface from "../validators/validator.interface";

export default class ValidatorService {
  private readonly _scanModeValidator: ValidatorInterface;
  private readonly _proxyValidator: ValidatorInterface;
  private readonly _externalSourceValidator: ValidatorInterface;
  private readonly _engineValidator: ValidatorInterface;
  private readonly _ipFilterValidator: ValidatorInterface;

  constructor() {
    this._scanModeValidator = new JoiValidator(scanModeSchema);
    this._proxyValidator = new JoiValidator(proxySchema);
    this._externalSourceValidator = new JoiValidator(externalSourceSchema);
    this._engineValidator = new JoiValidator(engineSchema);
    this._ipFilterValidator = new JoiValidator(ipFilterSchema);
  }

  get scanModeValidator(): ValidatorInterface {
    return this._scanModeValidator;
  }

  get proxyValidator(): ValidatorInterface {
    return this._proxyValidator;
  }

  get externalSourceValidator(): ValidatorInterface {
    return this._externalSourceValidator;
  }

  get engineValidator(): ValidatorInterface {
    return this._engineValidator;
  }

  get ipFilterValidator(): ValidatorInterface {
    return this._ipFilterValidator;
  }
}
