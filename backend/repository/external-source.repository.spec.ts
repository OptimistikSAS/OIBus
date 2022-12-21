import SqliteDatabaseMock from "../tests/__mocks__/database.mock";
import { generateRandomId } from "./utils";
import ExternalSourceRepository from "./external-source.repository";
import {
  ExternalSourceCommandDTO,
  ExternalSourceDTO,
} from "../model/external-sources.model";

jest.mock("../tests/__mocks__/database.mock");
jest.mock("./utils", () => ({
  generateRandomId: jest.fn(() => "123456"),
}));

let database;
let repository: ExternalSourceRepository;
describe("External source repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    repository = new ExternalSourceRepository(database);
  });

  it("should properly init external source table", () => {
    expect(database.prepare).toHaveBeenCalledWith(
      "CREATE TABLE IF NOT EXISTS external_sources (id TEXT PRIMARY KEY, reference TEXT, description TEXT);"
    );
    expect(database.run).toHaveBeenCalledTimes(1);
  });

  it("should properly get all external sources", () => {
    const expectedValue: Array<ExternalSourceDTO> = [
      {
        id: "id1",
        reference: "ref1",
        description: "my first external source",
      },
      {
        id: "id2",
        reference: "ref2",
        description: "my second external source",
      },
    ];
    database.all.mockReturnValueOnce(expectedValue);
    const externalSources = repository.getExternalSources();
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, reference, description FROM external_sources;"
    );
    expect(externalSources).toEqual(expectedValue);
  });

  it("should properly get an external source", () => {
    const expectedValue: ExternalSourceDTO = {
      id: "id1",
      reference: "ref1",
      description: "my first external source",
    };
    database.get.mockReturnValueOnce(expectedValue);
    const externalSource = repository.getExternalSource("id1");
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, reference, description FROM external_sources WHERE id = ?;"
    );
    expect(database.get).toHaveBeenCalledWith("id1");
    expect(externalSource).toEqual(expectedValue);
  });

  it("should create an external source", () => {
    const command: ExternalSourceCommandDTO = {
      reference: "ref1",
      description: "my first external source",
    };
    repository.createExternalSource(command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      "INSERT INTO external_sources (id, reference, description) VALUES (?, ?, ?);"
    );
    expect(database.run).toHaveBeenCalledWith(
      "123456",
      command.reference,
      command.description
    );
  });

  it("should update an external source", () => {
    const command: ExternalSourceCommandDTO = {
      reference: "ref1",
      description: "my first external source",
    };
    repository.updateExternalSource("id1", command);
    expect(database.prepare).toHaveBeenCalledWith(
      "UPDATE external_sources SET reference = ?, description = ? WHERE id = ?;"
    );
    expect(database.run).toHaveBeenCalledWith(
      command.reference,
      command.description,
      "id1"
    );
  });

  it("should delete an external source", () => {
    repository.deleteExternalSource("id1");
    expect(database.prepare).toHaveBeenCalledWith(
      "DELETE FROM external_sources WHERE id = ?;"
    );
    expect(database.run).toHaveBeenCalledWith("id1");
  });
});
