import Joi from "joi";
import JoiObjectSchemaMock from "../tests/__mocks__/joi-objectschema.mock";
import IpFilterValidator from "./ip-filter.validator";
import { IpFilterCommandDTO } from "../model/ip-filter.model";

describe("IP Filter validator", () => {
  const ipFilterCommandDTO: IpFilterCommandDTO = {
    address: "ip1",
    description: "my first ip filter",
  };
  const schemaMock = new JoiObjectSchemaMock();
  const validator: IpFilterValidator = new IpFilterValidator(
    schemaMock as Joi.ObjectSchema
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("should throw exception when DTO is invalid", async () => {
    const expectedError = new Error("Error message");
    schemaMock.validateAsync.mockRejectedValue(expectedError);
    await expect(validator.validate(ipFilterCommandDTO)).rejects.toThrowError(
      expectedError
    );
    expect(schemaMock.validateAsync).toBeCalledWith(ipFilterCommandDTO);
  });

  it("should not throw exception when DTO valid", async () => {
    await expect(validator.validate(ipFilterCommandDTO)).resolves.not.toThrow();
    expect(schemaMock.validateAsync).toBeCalledWith(ipFilterCommandDTO);
  });
});
