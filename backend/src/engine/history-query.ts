import path from 'node:path';
import { HistoryQueryDTO } from '../../../shared/model/history-query.model';
import { OibusItemDTO, SouthConnectorDTO } from '../../../shared/model/south-connector.model';
import { NorthConnectorDTO } from '../../../shared/model/north-connector.model';

import { createFolder } from '../service/utils';
import pino from 'pino';
import SouthService from '../service/south.service';
import NorthService from '../service/north.service';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';

const FINISH_INTERVAL = 5000;

export default class HistoryQuery {
  protected readonly baseFolder: string;
  private north: NorthConnector | null = null;
  private south: SouthConnector | null = null;
  private finishInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly historyConfiguration: HistoryQueryDTO,
    private readonly southService: SouthService,
    private readonly northService: NorthService,
    private items: Array<OibusItemDTO>,
    private logger: pino.Logger,
    baseFolder: string
  ) {
    this.baseFolder = path.resolve(baseFolder, historyConfiguration.id);
  }

  /**
   * Run history query according to its status
   */
  async start(): Promise<void> {
    await createFolder(this.baseFolder);

    const southConfiguration: SouthConnectorDTO = {
      id: this.historyConfiguration.id,
      name: `${this.historyConfiguration.name} (South)`,
      description: '',
      enabled: this.historyConfiguration.enabled,
      type: this.historyConfiguration.southType,
      settings: this.historyConfiguration.southSettings
    };
    const southFolder = path.resolve(this.baseFolder, 'south');
    await createFolder(southFolder);
    this.south = this.southService.createSouth(
      southConfiguration,
      this.items,
      this.addValues.bind(this),
      this.addFile.bind(this),
      southFolder,
      false,
      this.logger
    );
    if (!this.south) {
      throw new Error(
        `Could not instantiate South type ${this.historyConfiguration.southType} for History Query ${this.historyConfiguration.name} (${this.historyConfiguration.id})`
      );
    }

    const northConfiguration: NorthConnectorDTO = {
      id: this.historyConfiguration.id,
      name: `${this.historyConfiguration.name} (North)`,
      description: '',
      enabled: this.historyConfiguration.enabled,
      type: this.historyConfiguration.northType,
      settings: this.historyConfiguration.northSettings,
      caching: this.historyConfiguration.caching,
      archive: this.historyConfiguration.archive
    };
    const northFolder = path.resolve(this.baseFolder, 'north');
    await createFolder(northFolder);
    this.north = this.northService.createNorth(northConfiguration, northFolder, this.logger);
    if (!this.north) {
      throw new Error(
        `Could not instantiate North type ${this.historyConfiguration.northType} for History Query ${this.historyConfiguration.name} (${this.historyConfiguration.id})`
      );
    }

    if (!this.historyConfiguration.enabled) {
      this.logger.trace(`History Query "${this.historyConfiguration.name}" not enabled`);
      return;
    }

    this.finishInterval = setInterval(this.finish.bind(this), FINISH_INTERVAL);

    await this.north.start();
    await this.north.connect();

    await this.runSouthConnector();
  }

  async runSouthConnector(): Promise<void> {
    if (!this.south) {
      return;
    }
    await this.south.start();
    await this.south.connect();

    this.south
      .historyQueryHandler(this.items, this.historyConfiguration.startTime, this.historyConfiguration.endTime, 'history')
      .catch(async error => {
        this.logger.error(
          `Restarting South for "${this.historyConfiguration.name}" after an error while running South history query handler: ${error}`
        );
        await this.runSouthConnector();
      });
  }

  /**
   * Add new values from a South connector to the Engine.
   * The Engine will forward the values to the Cache.
   */
  async addValues(historyId: string, values: Array<any>): Promise<void> {
    if (this.north) {
      this.logger.info(`Add ${values.length} values from History Query "${this.historyConfiguration.name}" to north connector`);
      await this.north.cacheValues(values);
    }
  }

  /**
   * Add a new file from a South connector to the Engine.
   * The Engine will forward the file to the Cache.
   */
  async addFile(southId: string, filePath: string): Promise<void> {
    if (this.north) {
      this.logger.info(`Add file "${filePath}" from History Query "${this.historyConfiguration.name}" to north connector`);
      await this.north.cacheFile(filePath);
    }
  }

  /**
   * Stop history query
   */
  async stop(): Promise<void> {
    if (this.finishInterval) {
      clearInterval(this.finishInterval);
    }
    if (this.south) {
      await this.south.stop();
    }
    if (this.north) {
      await this.north.stop();
    }
  }

  /**
   * Finish HistoryQuery.
   */
  async finish(): Promise<void> {
    this.logger.info(`Finish "${this.historyConfiguration.name}" (${this.historyConfiguration.id})`);
    await this.stop();
  }

  async addItem(item: OibusItemDTO): Promise<void> {
    if (!this.south) {
      return;
    }
    await this.stop();
    this.south.addItem(item);
    await this.start();
  }

  async updateItem(item: OibusItemDTO): Promise<void> {
    if (!this.south) {
      return;
    }
    await this.deleteItem(item);
    await this.addItem(item);
  }

  deleteItem(item: OibusItemDTO) {
    if (!this.south) {
      return;
    }
    this.south.deleteItem(item);
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }
}
