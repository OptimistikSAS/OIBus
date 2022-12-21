import { generateRandomId } from "./utils";

describe("Repository utils", () => {
  it("should properly generate a random ID with a standard size", () => {
    const randomId = generateRandomId();
    expect(randomId.length).toEqual(16);
  });

  it("should properly generate a random ID with smaller size", () => {
    const randomId = generateRandomId(8);
    expect(randomId.length).toEqual(8);
  });

  it("should properly generate a random ID with bigger size", () => {
    const randomId = generateRandomId(32);
    expect(randomId.length).toEqual(32);
  });
});
