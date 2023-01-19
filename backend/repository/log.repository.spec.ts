import SqliteDatabaseMock from "../tests/__mocks__/database.mock";
import { generateRandomId } from "./utils";
import IpFilterRepository from "./ip-filter.repository";
import { IpFilterCommandDTO, IpFilterDTO } from "../model/ip-filter.model";
import LogRepository from "./log.repository";
import { Page } from "../model/types";
import { SouthItemDTO } from "../model/south-connector.model";
import { LogDTO } from "../model/logs.model";

jest.mock("../tests/__mocks__/database.mock");
jest.mock("./utils", () => ({
  generateRandomId: jest.fn(() => "123456"),
}));

let database;
let repository: LogRepository;
describe("Log repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    repository = new LogRepository(database);
  });

  it("should properly get logs by search criteria", () => {
    const expectedValue: Page<LogDTO> = {
      content: [
        {
          timestamp: "2023-01-01T00:00:00.000Z",
          level: "error",
          scope: "engine",
          message: "my log 1",
        },
        {
          timestamp: "2023-01-02T00:00:00.000Z",
          level: "error",
          scope: "engine",
          message: "my log 2",
        },
      ],
      size: 50,
      number: 0,
      totalElements: 2,
      totalPages: 1,
    };
    database.all.mockReturnValueOnce([
      {
        timestamp: "2023-01-01T00:00:00.000Z",
        level: "error",
        scope: "engine",
        message: "my log 1",
      },
      {
        timestamp: "2023-01-02T00:00:00.000Z",
        level: "error",
        scope: "engine",
        message: "my log 2",
      },
    ]);
    database.get.mockReturnValueOnce({ count: 2 });
    const logs = repository.searchLogs({
      page: 0,
      messageContent: "messageContent",
      scope: "myScope",
      start: "2023-01-01T00:00:00.000Z",
      end: "2023-01-02T00:00:00.000Z",
      levels: ["info", "debug"],
    });
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT timestamp, level, scope, message FROM logs WHERE timestamp BETWEEN ? AND ? AND level IN (?,?) " +
        "AND scope LIKE '%?%' AND message LIKE '%?%' ORDER BY timestamp DESC LIMIT 50 OFFSET ?;"
    );
    expect(logs).toEqual(expectedValue);

    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT COUNT(*) as count FROM logs WHERE timestamp BETWEEN ? AND ? AND level IN (?,?) AND scope LIKE '%?%' AND message LIKE '%?%'"
    );
  });
});
