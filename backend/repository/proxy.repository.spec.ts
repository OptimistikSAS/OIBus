import ProxyRepository from "./proxy.repository";
import SqliteDatabaseMock from "../tests/__mocks__/database.mock";
import { generateRandomId } from "./utils";
import { ProxyCommandDTO, ProxyDTO } from "../model/proxy.model";

jest.mock("../tests/__mocks__/database.mock");
jest.mock("./utils", () => ({
  generateRandomId: jest.fn(() => "123456"),
}));

let database;
let repository: ProxyRepository;
describe("Proxy repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    repository = new ProxyRepository(database);
  });

  it("should properly init proxy table", () => {
    expect(database.prepare).toHaveBeenCalledWith(
      "CREATE TABLE IF NOT EXISTS proxy (id TEXT PRIMARY KEY, name TEXT, description TEXT, address TEXT, username TEXT, password TEXT);"
    );
    expect(database.run).toHaveBeenCalledTimes(1);
  });

  it("should properly get all proxies", () => {
    const expectedValue: Array<ProxyDTO> = [
      {
        id: "id1",
        name: "proxy1",
        description: "my first proxy",
        address: "http://proxy.com:1234",
        username: "username",
        password: "password",
      },
      {
        id: "id2",
        name: "proxy2",
        description: "my second proxy",
        address: "https://proxy.com:8080",
        username: "username",
        password: "password",
      },
    ];
    database.all.mockReturnValueOnce(expectedValue);
    const proxies = repository.getProxies();
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, description, address, username, password FROM proxy;"
    );
    expect(proxies).toEqual(expectedValue);
  });

  it("should properly get a proxy", () => {
    const expectedValue: ProxyDTO = {
      id: "id1",
      name: "proxy1",
      description: "my first proxy",
      address: "http://proxy.com:1234",
      username: "username",
      password: "password",
    };
    database.get.mockReturnValueOnce(expectedValue);
    const proxy = repository.getProxy("id1");
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, name, description, address, username, password FROM proxy WHERE id = ?;"
    );
    expect(database.get).toHaveBeenCalledWith("id1");
    expect(proxy).toEqual(expectedValue);
  });

  it("should create a proxy", () => {
    const command: ProxyCommandDTO = {
      name: "proxy1",
      description: "my first proxy",
      address: "http://proxy.com:1234",
      username: "username",
      password: "password",
    };
    repository.createProxy(command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      "INSERT INTO proxy (id, name, description, address, username, password) VALUES (?, ?, ?, ?, ?, ?);"
    );
    expect(database.run).toHaveBeenCalledWith(
      "123456",
      command.name,
      command.description,
      command.address,
      command.username,
      command.password
    );
  });

  it("should update a proxy", () => {
    const command: ProxyCommandDTO = {
      name: "proxy1",
      description: "my first proxy",
      address: "http://proxy.com:1234",
      username: "username",
      password: "password",
    };
    repository.updateProxy("id1", command);
    expect(database.prepare).toHaveBeenCalledWith(
      "UPDATE proxy SET name = ?, description = ?, address = ?, username = ?, password = ? WHERE id = ?;"
    );
    expect(database.run).toHaveBeenCalledWith(
      command.name,
      command.description,
      command.address,
      command.username,
      command.password,
      "id1"
    );
  });

  it("should delete a proxy", () => {
    repository.deleteProxy("id1");
    expect(database.prepare).toHaveBeenCalledWith(
      "DELETE FROM proxy WHERE id = ?;"
    );
    expect(database.run).toHaveBeenCalledWith("id1");
  });
});
