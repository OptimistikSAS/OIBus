import SqliteDatabaseMock from "../tests/__mocks__/database.mock";
import { generateRandomId } from "./utils";
import SouthScanRepository from "./south-scan.repository";
import {
  SouthScanCommandDTO,
  SouthScanDTO,
} from "../model/south-connector.model";

jest.mock("../tests/__mocks__/database.mock");
jest.mock("./utils", () => ({
  generateRandomId: jest.fn(() => "123456"),
}));

let database;
let repository: SouthScanRepository;
describe("South scan repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    repository = new SouthScanRepository(database);
  });

  it("should properly init south scan table", () => {
    expect(database.prepare).toHaveBeenCalledWith(
      "CREATE TABLE IF NOT EXISTS south_scan (id TEXT PRIMARY KEY, south_id TEXT, scan_mode_id TEXT, name TEXT, " +
        "settings TEXT, FOREIGN KEY(south_id) REFERENCES south_connector(id), " +
        "FOREIGN KEY(scan_mode_id) REFERENCES scan_mode(id));"
    );
    expect(database.run).toHaveBeenCalledTimes(1);
  });

  it("should properly get south scans by South ID", () => {
    const expectedValue: Array<SouthScanDTO> = [
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
    ];
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
    const southScans = repository.getSouthScans("south1");
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, south_id AS southId, scan_mode_id AS scanModeId, settings FROM south_scan WHERE south_id = ?;"
    );
    expect(southScans).toEqual(expectedValue);
  });

  it("should properly get a south scan", () => {
    const expectedValue: SouthScanDTO = {
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
    const southScan = repository.getSouthScan("id1");
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, south_id AS southId, scan_mode_id AS scanModeId, settings FROM south_scan WHERE id = ?;"
    );
    expect(database.get).toHaveBeenCalledWith("id1");
    expect(southScan).toEqual(expectedValue);
  });

  it("should create a south scan", () => {
    const command: SouthScanCommandDTO = {
      name: "southScan1",
      southId: "southId",
      scanModeId: "scanModeId",
      settings: {},
    };
    repository.createSouthScan(command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      "INSERT INTO south_scan (id, name, south_id, scan_mode_id, settings) VALUES (?, ?, ?, ?, ?);"
    );
    expect(database.run).toHaveBeenCalledWith(
      "123456",
      command.name,
      command.southId,
      command.scanModeId,
      JSON.stringify(command.settings)
    );

    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, south_id AS southId, scan_mode_id AS scanModeId, settings FROM south_scan WHERE ROWID = ?;"
    );
  });

  it("should update a south scan", () => {
    const command: SouthScanCommandDTO = {
      name: "southScan1",
      southId: "southId",
      scanModeId: "scanModeId",
      settings: {},
    };
    repository.updateSouthScan("id1", command);
    expect(database.prepare).toHaveBeenCalledWith(
      "UPDATE south_scan SET name = ?, scan_mode_id = ?, settings = ? WHERE id = ?;"
    );
    expect(database.run).toHaveBeenCalledWith(
      command.name,
      command.scanModeId,
      JSON.stringify(command.settings),
      "id1"
    );
  });

  it("should delete a south scan", () => {
    repository.deleteSouthScan("id1");
    expect(database.prepare).toHaveBeenCalledWith(
      "DELETE FROM south_scan WHERE id = ?;"
    );
    expect(database.run).toHaveBeenCalledWith("id1");
  });
});
