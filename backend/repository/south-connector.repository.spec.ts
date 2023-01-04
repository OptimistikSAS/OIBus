import SqliteDatabaseMock from "../tests/__mocks__/database.mock";
import { generateRandomId } from "./utils";
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
} from "../model/south-connector.model";
import SouthConnectorRepository from "./south-connector.repository";

jest.mock("../tests/__mocks__/database.mock");
jest.mock("./utils", () => ({
  generateRandomId: jest.fn(() => "123456"),
}));

let database;
let repository: SouthConnectorRepository;
describe("South connector repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    repository = new SouthConnectorRepository(database);
  });

  it("should properly init south connector table", () => {
    expect(database.prepare).toHaveBeenCalledWith(
      "CREATE TABLE IF NOT EXISTS south_connector (id TEXT PRIMARY KEY, name TEXT, type TEXT, description TEXT, " +
        "enabled INTEGER, settings TEXT);"
    );
    expect(database.run).toHaveBeenCalledTimes(1);
  });

  it("should properly get south connectors", () => {
    const expectedValue: Array<SouthConnectorDTO> = [
      {
        id: "id1",
        name: "south1",
        type: "SouthConnector",
        description: "My south connector",
        enabled: true,
        settings: {},
      },
      {
        id: "id2",
        name: "south2",
        type: "SouthConnector",
        description: "My second south connector",
        enabled: true,
        settings: {},
      },
    ];
    database.all.mockReturnValueOnce([
      {
        id: "id1",
        name: "south1",
        type: "SouthConnector",
        description: "My south connector",
        enabled: true,
        settings: JSON.stringify({}),
      },
      {
        id: "id2",
        name: "south2",
        type: "SouthConnector",
        description: "My second south connector",
        enabled: true,
        settings: JSON.stringify({}),
      },
    ]);
    const southConnectors = repository.getSouthConnectors();
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, type, description, enabled, settings FROM south_connector;"
    );
    expect(southConnectors).toEqual(expectedValue);
  });

  it("should properly get a south connector", () => {
    const expectedValue: SouthConnectorDTO = {
      id: "id1",
      name: "south1",
      type: "SouthConnector",
      description: "My south connector",
      enabled: true,
      settings: {},
    };
    database.get.mockReturnValueOnce({
      id: "id1",
      name: "south1",
      type: "SouthConnector",
      description: "My south connector",
      enabled: true,
      settings: JSON.stringify({}),
    });
    const southConnector = repository.getSouthConnector("id1");
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, type, description, enabled, settings FROM south_connector WHERE id = ?;"
    );
    expect(database.get).toHaveBeenCalledWith("id1");
    expect(southConnector).toEqual(expectedValue);
  });

  it("should create a south connector", () => {
    const command: SouthConnectorCommandDTO = {
      name: "south1",
      type: "SouthConnector",
      description: "My south connector",
      enabled: true,
      settings: {},
    };
    repository.createSouthConnector(command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      "INSERT INTO south_connector (id, name, type, description, enabled, settings) VALUES (?, ?, ?, ?, ?, ?);"
    );
    expect(database.run).toHaveBeenCalledWith(
      "123456",
      command.name,
      command.type,
      command.description,
      +command.enabled,
      JSON.stringify(command.settings)
    );

    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, type, description, enabled, settings FROM south_connector WHERE ROWID = ?;"
    );
  });

  it("should update a south connector", () => {
    const command: SouthConnectorCommandDTO = {
      name: "south1",
      type: "SouthConnector",
      description: "My south connector",
      enabled: true,
      settings: {},
    };
    repository.updateSouthConnector("id1", command);
    expect(database.prepare).toHaveBeenCalledWith(
      "UPDATE south_connector SET name = ?, description = ?, enabled = ?, settings = ? WHERE id = ?;"
    );
    expect(database.run).toHaveBeenCalledWith(
      command.name,
      command.description,
      +command.enabled,
      JSON.stringify(command.settings),
      "id1"
    );
  });

  it("should delete a south connector", () => {
    repository.deleteSouthConnector("id1");
    expect(database.prepare).toHaveBeenCalledWith(
      "DELETE FROM south_connector WHERE id = ?;"
    );
    expect(database.run).toHaveBeenCalledWith("id1");
  });
});
