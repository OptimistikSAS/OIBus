import SqliteDatabaseMock from "../tests/__mocks__/database.mock";
import { generateRandomId } from "./utils";
import SouthItemRepository from "./south-item.repository";
import {
  SouthItemCommandDTO,
  SouthItemDTO,
} from "../model/south-connector.model";
import { Page } from "../model/types";

jest.mock("../tests/__mocks__/database.mock");
jest.mock("./utils", () => ({
  generateRandomId: jest.fn(() => "123456"),
}));

let database;
let repository: SouthItemRepository;
describe("South item repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    repository = new SouthItemRepository(database);
  });

  it("should properly init south scan table", () => {
    expect(database.prepare).toHaveBeenCalledWith(
      "CREATE TABLE IF NOT EXISTS south_item (id TEXT PRIMARY KEY, south_id TEXT, scan_mode_id TEXT, name TEXT, " +
        "settings TEXT, FOREIGN KEY(south_id) REFERENCES south_connector(id), " +
        "FOREIGN KEY(scan_mode_id) REFERENCES scan_mode(id));"
    );
    expect(database.run).toHaveBeenCalledTimes(1);
  });

  it("should properly get south items by South ID", () => {
    const expectedValue: Page<SouthItemDTO> = {
      content: [
        {
          id: "id1",
          name: "my south scan",
          southId: "south1",
          scanModeId: "scanMode1",
          settings: {},
        },
        {
          id: "id2",
          name: "my second south scan",
          southId: "south1",
          scanModeId: "scan1",
          settings: {},
        },
      ],
      size: 50,
      number: 0,
      totalElements: 2,
      totalPages: 1,
    };
    database.all.mockReturnValueOnce([
      {
        id: "id1",
        name: "my south scan",
        southId: "south1",
        scanModeId: "scanMode1",
        settings: JSON.stringify({}),
      },
      {
        id: "id2",
        name: "my second south scan",
        southId: "south1",
        scanModeId: "scan1",
        settings: JSON.stringify({}),
      },
    ]);
    database.get.mockReturnValueOnce({ count: 2 });
    const southScans = repository.searchSouthItems("southId", {
      page: 0,
      name: "my item",
    });
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, south_id AS southId, scan_mode_id AS scanModeId, settings FROM south_item WHERE " +
        "south_id = ? AND name like '%my item%' LIMIT 50 OFFSET 0;"
    );
    expect(southScans).toEqual(expectedValue);
  });

  it("should properly get a south item", () => {
    const expectedValue: SouthItemDTO = {
      id: "id1",
      name: "southScan1",
      southId: "southId",
      scanModeId: "scanModeId",
      settings: {},
    };
    database.get.mockReturnValueOnce({
      id: "id1",
      name: "southScan1",
      southId: "southId",
      scanModeId: "scanModeId",
      settings: JSON.stringify({}),
    });
    const southScan = repository.getSouthItem("id1");
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, south_id AS southId, scan_mode_id AS scanModeId, settings FROM south_item WHERE id = ?;"
    );
    expect(database.get).toHaveBeenCalledWith("id1");
    expect(southScan).toEqual(expectedValue);
  });

  it("should create a south item", () => {
    const command: SouthItemCommandDTO = {
      name: "southScan1",
      scanModeId: "scanModeId",
      settings: {},
    };
    repository.createSouthItem("southId", command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      "INSERT INTO south_item (id, name, south_id, scan_mode_id, settings) VALUES (?, ?, ?, ?, ?);"
    );
    expect(database.run).toHaveBeenCalledWith(
      "123456",
      command.name,
      "southId",
      command.scanModeId,
      JSON.stringify(command.settings)
    );

    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, south_id AS southId, scan_mode_id AS scanModeId, settings FROM south_item WHERE ROWID = ?;"
    );
  });

  it("should update a south item", () => {
    const command: SouthItemCommandDTO = {
      name: "southScan1",
      scanModeId: "scanModeId",
      settings: {},
    };
    repository.updateSouthItem("id1", command);
    expect(database.prepare).toHaveBeenCalledWith(
      "UPDATE south_item SET name = ?, scan_mode_id = ?, settings = ? WHERE id = ?;"
    );
    expect(database.run).toHaveBeenCalledWith(
      command.name,
      command.scanModeId,
      JSON.stringify(command.settings),
      "id1"
    );
  });

  it("should delete a south item", () => {
    repository.deleteSouthItem("id1");
    expect(database.prepare).toHaveBeenCalledWith(
      "DELETE FROM south_item WHERE id = ?;"
    );
    expect(database.run).toHaveBeenCalledWith("id1");
  });
});
