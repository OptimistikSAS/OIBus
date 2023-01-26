import JoiValidator from "./joi.validator";
import { ipFilterSchema } from "../engine/oibus-validation-schema";
import ValidatorInterface from "./validator.interface";

interface IpFilterDataProvider {
  ipFilterCommandDTO: any;
  isValid: boolean;
  errorMessage: string | null;
}

const ipFilterDataProviders: IpFilterDataProvider[] = [
  {
    ipFilterCommandDTO: {
      address1: "missing",
      description1: "missing",
    },
    isValid: false,
    errorMessage:
      '"address" is required. "description" is required. "address1" is not allowed. "description1" is not allowed',
  },
  {
    ipFilterCommandDTO: {
      address: false,
      description: null,
    },
    isValid: false,
    errorMessage: '"address" must be a string',
  },
  {
    ipFilterCommandDTO: {
      address: "",
      description: "",
    },
    isValid: false,
    errorMessage: '"address" is not allowed to be empty',
  },
  {
    ipFilterCommandDTO: {
      address: "valid",
      description: "valid",
      description1: "invalid",
    },
    isValid: false,
    errorMessage: '"description1" is not allowed',
  },
  {
    ipFilterCommandDTO: {
      address: "valid",
      description: "valid",
    },
    isValid: true,
    errorMessage: null,
  },
];

describe("Ip filter validator", () => {
  const validator: ValidatorInterface = new JoiValidator(ipFilterSchema);

  it.each(ipFilterDataProviders)(
    `$# Should be valid: $isValid`,
    async (ipFilterDataProvider) => {
      if (ipFilterDataProvider.isValid) {
        await expect(
          validator.validate(ipFilterDataProvider.ipFilterCommandDTO)
        ).resolves.not.toThrow();
      } else {
        await expect(
          validator.validate(ipFilterDataProvider.ipFilterCommandDTO)
        ).rejects.toThrowError(new Error(ipFilterDataProvider.errorMessage));
      }
    }
  );
});
