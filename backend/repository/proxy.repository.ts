import { generateRandomId } from "./utils";
import { ProxyCommandDTO, ProxyDTO } from "../model/proxy.model";

const PROXY_TABLE = "proxy";

/**
 * Repository used for proxies
 */
export default class ProxyRepository {
  private readonly database;
  constructor(database) {
    this.database = database;
    const query =
      `CREATE TABLE IF NOT EXISTS ${PROXY_TABLE} (id TEXT PRIMARY KEY, name TEXT, description TEXT, ` +
      "address TEXT, username TEXT, password TEXT);";
    this.database.prepare(query).run();
  }

  /**
   * Retrieve all proxies
   */
  getProxies(): Array<ProxyDTO> {
    const query = `SELECT id, name, description, address, username, password FROM ${PROXY_TABLE};`;
    return this.database.prepare(query).all();
  }

  /**
   * Retrieve a proxy by its ID
   */
  getProxy(id: string): ProxyDTO {
    const query = `SELECT id, name, description, address, username, password FROM ${PROXY_TABLE} WHERE id = ?;`;
    return this.database.prepare(query).get(id);
  }

  /**
   * Create a proxy with a random generated ID
   */
  createProxy(command: ProxyCommandDTO): void {
    const id = generateRandomId(6);
    const query =
      `INSERT INTO ${PROXY_TABLE} (id, name, description, address, username, password) ` +
      "VALUES (?, ?, ?, ?, ?, ?);";
    return this.database
      .prepare(query)
      .run(
        id,
        command.name,
        command.description,
        command.address,
        command.username,
        command.password
      );
  }

  /**
   * Update a proxy by its ID
   */
  updateProxy(id: string, command: ProxyCommandDTO): void {
    const query = `UPDATE ${PROXY_TABLE} SET name = ?, description = ?, address = ?, username = ?, password = ? WHERE id = ?;`;
    return this.database
      .prepare(query)
      .run(
        command.name,
        command.description,
        command.address,
        command.username,
        command.password,
        id
      );
  }

  /**
   * Delete a proxy by its ID
   */
  deleteProxy(id: string): void {
    const query = `DELETE FROM ${PROXY_TABLE} WHERE id = ?;`;
    return this.database.prepare(query).run(id);
  }
}
