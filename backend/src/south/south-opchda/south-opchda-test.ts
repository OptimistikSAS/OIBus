import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import pino from 'pino';
import { HandlesAgent } from './agent-handler-interface';
import Agent from './agent';

export default class SouthOPCHDATest implements HandlesAgent {
  private readonly logger: pino.Logger;
  private readonly settings: SouthConnectorDTO['settings'];

  private agent: Agent;

  constructor(settings: SouthConnectorDTO['settings'], logger: pino.Logger) {
    this.settings = settings;
    this.logger = logger;

    this.agent = new Agent(this, settings, logger);
  }

  async testConnection(): Promise<void> {
    if (process.platform !== 'win32') {
      throw new Error(`OIBus OPCHDA Agent only supported on Windows: ${process.platform}`);
    }

    try {
      await this.agent?.connect();
    } catch (error) {
      throw new Error(`Unable to connect to "${this.settings.serverName}" on ${this.settings.host}: ${error}`);
    } finally {
      await this.agent?.disconnect();
    }
  }

  async handleConnectMessage(connected: boolean, error: string): Promise<void> {
    if (connected) {
      this.logger.info(`Connected to "${this.settings.serverName}" on ${this.settings.host}`);
    } else {
      this.logger.error(`Unable to connect to "${this.settings.serverName}" on ${this.settings.host}: ${error}`);
    }
  }

  async handleInitializeMessage(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async handleReadMessage(_values: any[]): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
