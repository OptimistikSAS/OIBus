import ScanModeRepository from "./scan-mode.repository";
import { ScanModeCommandDTO, ScanModeDTO } from "../model/scan-mode.model";
import SqliteDatabaseMock from "../tests/__mocks__/database.mock";
import { generateRandomId } from "./utils";

jest.mock("../tests/__mocks__/database.mock");
jest.mock("./utils", () => ({
  generateRandomId: jest.fn(() => "123456"),
}));

let database;
let repository: ScanModeRepository;
describe("Scan mode repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    repository = new ScanModeRepository(database);
  });

  it("should properly init scan mode table", () => {
    expect(database.prepare).toHaveBeenCalledWith(
      "CREATE TABLE IF NOT EXISTS scan_mode (id TEXT PRIMARY KEY, name TEXT, description TEXT, cron TEXT);"
    );
    expect(database.run).toHaveBeenCalledTimes(1);
  });

  it("should properly get all scan modes", () => {
    const expectedValue: Array<ScanModeDTO> = [
      {
        id: "id1",
        name: "scanMode1",
        description: "my first scanMode",
        cron: "* * * * * *",
      },
      {
        id: "id2",
        name: "scanMode2",
        description: "my second scanMode",
        cron: "* * * * * *",
      },
    ];
    database.all.mockReturnValueOnce(expectedValue);
    const scanModes = repository.getScanModes();
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, description, cron FROM scan_mode;"
    );
    expect(scanModes).toEqual(expectedValue);
  });

  it("should properly get a scan mode", () => {
    const expectedValue: ScanModeDTO = {
      id: "id1",
      name: "scanMode1",
      description: "my first scanMode",
      cron: "* * * * * *",
    };
    database.get.mockReturnValueOnce(expectedValue);
    const scanMode = repository.getScanMode("id1");
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, description, cron FROM scan_mode WHERE id = ?;"
    );
    expect(database.get).toHaveBeenCalledWith("id1");
    expect(scanMode).toEqual(expectedValue);
  });

  it("should create a scan mode", () => {
    const command: ScanModeCommandDTO = {
      name: "scanMode1",
      description: "my first scanMode",
      cron: "* * * * * *",
    };
    repository.createScanMode(command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      "INSERT INTO scan_mode (id, name, description, cron) VALUES (?, ?, ?, ?);"
    );
    expect(database.run).toHaveBeenCalledWith(
      "123456",
      command.name,
      command.description,
      command.cron
    );
  });

  it("should update a scan mode", () => {
    const command: ScanModeCommandDTO = {
      name: "scanMode1",
      description: "my first scanMode",
      cron: "* * * * * *",
    };
    repository.updateScanMode("id1", command);
    expect(database.prepare).toHaveBeenCalledWith(
      "UPDATE scan_mode SET name = ?, description = ?, cron = ? WHERE id = ?;"
    );
    expect(database.run).toHaveBeenCalledWith(
      command.name,
      command.description,
      command.cron,
      "id1"
    );
  });

  it("should delete a scan mode", () => {
    repository.deleteScanMode("id1");
    expect(database.prepare).toHaveBeenCalledWith(
      "DELETE FROM scan_mode WHERE id = ?;"
    );
    expect(database.run).toHaveBeenCalledWith("id1");
  });
});
