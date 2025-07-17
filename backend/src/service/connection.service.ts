import DataStreamEngine from '../engine/data-stream-engine';

/**
 * Service to manage shared connections within OIBus
 */
export default class ConnectionService {
  private static instance: ConnectionService | null = null;
  private dataStreamEngine: DataStreamEngine | null = null;

  async getConnection<T>(connectorType: 'north' | 'south', connectorId: string): Promise<T | null> {
    if (!this.dataStreamEngine) return null;
    let connector;
    if (connectorType === 'north') {
      connector = this.dataStreamEngine.getNorth(connectorId);
    } else {
      connector = this.dataStreamEngine.getSouth(connectorId);
    }
    if (!connector || !connector.sharableConnection()) return null;
    return (await connector.getSession()) as T;
  }

  async closeSession(connectorType: 'north' | 'south', connectorId: string, currentConnector: string, force: boolean) {
    if (!this.dataStreamEngine) return;
    if (connectorType === 'north') {
      const north = this.dataStreamEngine.getNorth(connectorId);
      if (!north || !north.sharableConnection()) {
        return;
      }
      if (force || (!north.isEnabled() && !this.isConnectionUsed(connectorType, connectorId, currentConnector))) {
        await north.closeSession();
      }
    } else {
      const south = this.dataStreamEngine.getSouth(connectorId);
      if (!south || !south.sharableConnection()) {
        return;
      }
      if (force || (!south.isEnabled() && !this.isConnectionUsed(connectorType, connectorId, currentConnector))) {
        await south.closeSession();
      }
    }
  }

  isConnectionUsed(connectorType: 'north' | 'south', connectorId: string, currentConnectorId: string): boolean {
    if (!this.dataStreamEngine) return false;
    return this.dataStreamEngine.isConnectionUsed(connectorType, connectorId, currentConnectorId);
  }

  init(dataStreamEngine: DataStreamEngine) {
    this.dataStreamEngine = dataStreamEngine;
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new ConnectionService();
    }
    return this.instance;
  }
}

export const connectionService = ConnectionService.getInstance();
