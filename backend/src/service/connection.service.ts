import { SouthSettings } from '../../../shared/model/south-settings.model';
import { isDeepStrictEqual } from 'util';
import DeferredPromise from './deferred-promise';
import pino from 'pino';

/**
 * DTO for creating a managed connection
 */
export interface ManagedConnectionDTO<TSession> {
  /**
   * The type of the connection (usually the type of the connector eg. 'opcua')
   */
  type: string;
  /**
   * Connector settings to distinguish between different connections
   */
  connectorSettings: SouthSettings;
  /**
   * The function to call when creating a new session for the connection
   *
   * Note: The function has to bind the proper context beforehand
   */
  createSessionFn: () => Promise<TSession | null>;
  /**
   * Additional settings for the managed connection
   */
  settings: ManagedConnectionSettings<TSession>;
}

/**
 * Settings for a managed connection
 */
export interface ManagedConnectionSettings<TSession> {
  /**
   * The name of the function to call when closing the connection
   */
  closeFnName: keyof TSession;
  /**
   * Whether the connection can be shared or not
   */
  sharedConnection: boolean;
}

interface ManagedConnectionMetadata<TSession> {
  instance: ManagedConnection<TSession>;
  reliantConnectorIds: Set<string>;
  connectorSettings: SouthSettings;
  sharedConnection: boolean;
}

/**
 * Service to manage connections within OIBus
 */
export default class ConnectionService {
  private readonly connections = new Map<string, Array<ManagedConnectionMetadata<any>>>();
  private readonly logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ scopeType: 'internal', scopeName: 'ConnectionService' });
  }

  /**
   * Creates a new connection and returns it
   *
   * If a connection with the same settings already exists and is shared, the existing connection will be returned
   */
  create<TSession>(connectorId: string, connectionDTO: ManagedConnectionDTO<TSession>): ManagedConnection<TSession> {
    const foundConnection = this.findConnection(connectorId, connectionDTO);

    if (foundConnection) {
      this.logger.trace(`Connection of type "${connectionDTO.type}" already exists, returning existing connection`);
      foundConnection.reliantConnectorIds.add(connectorId);
      return foundConnection.instance;
    }

    const reliantConnectorIds = new Set([connectorId]);
    const instance = new ManagedConnectionClass<TSession>(
      connectionDTO,
      reliantConnectorIds,
      this.logger.child({ scopeType: 'internal', scopeName: `ManagedConnection (${connectionDTO.type})` })
    );

    // Initialize the array if it does not exist
    if (!this.connections.has(connectionDTO.type)) {
      this.connections.set(connectionDTO.type, []);
    }

    // Add the new connection to the array
    this.connections.get(connectionDTO.type)!.push({
      instance,
      reliantConnectorIds,
      connectorSettings: connectionDTO.connectorSettings,
      sharedConnection: connectionDTO.settings.sharedConnection
    });

    this.logger.debug(`New connection of type "${connectionDTO.type}" created`);

    return instance;
  }

  /**
   * Removes the connection used by the given connector
   *
   * If the connection is shared, it will not be removed until all reliant connectors are removed
   */
  async remove(type: string, connectorId: string) {
    const connectionsOfType = this.connections.get(type);

    if (!connectionsOfType) {
      this.logger.trace(`Connection type "${type}" not found. Nothing to remove`);
      return;
    }

    const connectionIndex = connectionsOfType.findIndex(c => c.reliantConnectorIds.has(connectorId));

    if (connectionIndex === -1) {
      this.logger.trace(`No connection found for connector "${connectorId}" of type "${type}". Nothing to remove`);
      return;
    }

    const connection = connectionsOfType[connectionIndex];
    connection.reliantConnectorIds.delete(connectorId);
    this.logger.debug(`Connector "${connectorId}" removed from connection of type "${type}"`);

    if (connection.reliantConnectorIds.size === 0) {
      this.logger.trace(`No reliant connectors left for connection of type "${type}", closing connection`);
      await connection.instance.close();
      connectionsOfType.splice(connectionIndex, 1);
      this.logger.debug(`Connection of type "${type}" removed`);
    }
  }

  /**
   * Finds a connection that satisfies the given settings,
   * or returns null if no such connection exists
   */
  private findConnection(connectorId: string, connectionDTO: ManagedConnectionDTO<any>): ManagedConnectionMetadata<any> | null {
    const {
      type,
      connectorSettings,
      settings: { sharedConnection }
    } = connectionDTO;
    const connectionsOfType = this.connections.get(type);

    if (!connectionsOfType) {
      return null;
    }

    // If the connection is shared, it can be used by any connector,
    // so we only need to check if the connector settings are the same
    if (sharedConnection) {
      const connectionMeta = connectionsOfType.find(c => c.sharedConnection && isDeepStrictEqual(c.connectorSettings, connectorSettings));
      return connectionMeta ?? null;
    }

    // If the connection is not shared, it can only be used by the connector that created it,
    // so we need to check if the connector settings are the same and if the connector is the creator
    const connectionMeta = connectionsOfType.find(
      c => !c.sharedConnection && c.reliantConnectorIds.has(connectorId) && isDeepStrictEqual(c.connectorSettings, connectorSettings)
    );
    return connectionMeta ?? null;
  }
}

class ManagedConnectionClass<TSession> {
  protected _session: TSession | null = null;
  protected createPromise$: DeferredPromise | undefined;
  protected closePromise$: DeferredPromise | undefined;

  constructor(
    private readonly dto: ManagedConnectionDTO<TSession>,
    private readonly reliantConnectorIds: Set<string>,
    private readonly logger: pino.Logger
  ) {}

  /**
   * Gets the session, creating it if it does not exist
   * @throws Error if the session could not be created
   */
  async getSession(): Promise<TSession> {
    this.logger.trace('Getting session');

    if (this._session) {
      this.logger.trace('Session already exists, returning existing session');
      return this._session;
    }

    // Lock the creation of a new session
    if (this.createPromise$) {
      // Wait for any other session creation to finish
      await this.createPromise$.promise;

      // Check if the session was created while waiting
      if (this._session) {
        this.logger.trace('Session already exists, returning existing session');
        return this._session;
      }
    }

    this.createPromise$ = new DeferredPromise();
    this.logger.trace('Creating new session');

    try {
      this._session = await this.dto.createSessionFn();
      if (!this._session) {
        throw new Error('Session create function returned null');
      }

      this.logger.trace('Session created');
      return this._session;
    } catch (error: unknown) {
      this.logger.error(`Session could not be created: ${(error as Error).message}`);
      throw error;
    } finally {
      // Unlock the creation of a new session
      this.createPromise$.resolve();
      this.createPromise$ = undefined;
    }
  }

  /**
   * Closes the session
   * @throws Error if the session close function throws an error
   */
  async close(): Promise<void> {
    this.logger.trace('Closing session');

    if (!this._session) {
      this.logger.trace('Session does not exist, nothing to close');
      return;
    }

    if (this.reliantConnectorIds.size > 0) {
      this.logger.trace('Session is still being used by other connectors, not closing the session');
      return;
    }

    // Lock the closing of a session
    if (this.closePromise$) {
      // Wait for any other session closing to finish
      await this.closePromise$.promise;

      // Check if the session was closed while waiting
      if (!this._session) {
        this.logger.trace('Session does not exist, nothing to close');
        return;
      }
    }

    this.closePromise$ = new DeferredPromise();

    try {
      await (this._session[this.dto.settings.closeFnName] as any).call(this._session);
      this._session = null;
      this.logger.trace('Session closed');
    } catch (error: unknown) {
      this.logger.error(`Session could not be closed: ${(error as Error).message}`);
      throw error;
    } finally {
      // Unlock the closing of a session
      this.closePromise$.resolve();
      this.closePromise$ = undefined;
    }
  }
}

// Only export the type, to prevent the class from being used directly
export type ManagedConnection<TSession> = ManagedConnectionClass<TSession>;
