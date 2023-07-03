import path from 'node:path';
import { HistoryQueryDTO } from '../../../shared/model/history-query.model';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../shared/model/south-connector.model';
import { NorthConnectorDTO } from '../../../shared/model/north-connector.model';

import { createFolder } from '../service/utils';
import pino from 'pino';
import SouthService from '../service/south.service';
import NorthService from '../service/north.service';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import HistoryMetricsService from '../service/history-metrics.service';
import HistoryQueryService from '../service/history-query.service';
import { PassThrough } from 'node:stream';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';

const FINISH_INTERVAL = 5000;

export default class HistoryQuery {
  protected readonly baseFolder: string;
  private north: NorthConnector<any> | null = null;
  private south: SouthConnector<any, any> | null = null;
  private finishInterval: NodeJS.Timeout | null = null;
  private _metricsService: HistoryMetricsService;

  constructor(
    private readonly historyConfiguration: HistoryQueryDTO,
    private readonly southService: SouthService,
    private readonly northService: NorthService,
    private readonly historyService: HistoryQueryService,
    private items: Array<SouthConnectorItemDTO<any>>,
    private logger: pino.Logger,
    baseFolder: string
  ) {
    this.baseFolder = baseFolder;
    this._metricsService = new HistoryMetricsService(historyConfiguration.id);
  }

  /**
   * Run history query according to its status
   */
  async start<S extends SouthSettings, N extends NorthSettings>(): Promise<void> {
    const southConfiguration: SouthConnectorDTO<S> = {
      id: this.historyConfiguration.id,
      name: `${this.historyConfiguration.name} (South)`,
      description: '',
      enabled: this.historyConfiguration.enabled,
      history: this.historyConfiguration.history,
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

    const northConfiguration: NorthConnectorDTO<N> = {
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

    this.south.getMetricsDataStream().on('data', data => {
      // Remove the 'data: ' start of the string
      const southMetrics = JSON.parse(Buffer.from(data).toString().slice(6));
      this._metricsService.updateMetrics({ ...this._metricsService.metrics, south: southMetrics });
    });

    this.north.getMetricsDataStream().on('data', data => {
      // Remove the 'data: ' start of the string
      const northMetrics = JSON.parse(Buffer.from(data).toString().slice(6));
      this._metricsService.updateMetrics({ ...this._metricsService.metrics, north: northMetrics });
    });

    await this.north.init();
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
  async stop(resetCache = false): Promise<void> {
    if (this.finishInterval) {
      clearInterval(this.finishInterval);
    }
    if (this.south) {
      await this.south.stop();
      if (resetCache) {
        await this.south.resetCache();
      }
    }
    if (this.north) {
      await this.north.stop();
      if (resetCache) {
        await this.north.resetCache();
      }
    }
    this.historyService.stopHistoryQuery(this.historyConfiguration.id);
  }

  /**
   * Finish HistoryQuery.
   */
  async finish(): Promise<void> {
    if (!this.north || !this.south || ((await this.north.isCacheEmpty()) && !this.south.historyIsRunning)) {
      this.logger.info(`Finish "${this.historyConfiguration.name}" (${this.historyConfiguration.id})`);
      await this.stop();
    } else {
      this.logger.debug(`History query "${this.historyConfiguration.name}" is still running`);
    }
  }

  async addItem<I extends SouthItemSettings>(item: SouthConnectorItemDTO<I>): Promise<void> {
    if (!this.south) {
      return;
    }
    await this.stop();
    this.south.addItem(item);
    await this.start();
  }

  async updateItem<I extends SouthItemSettings>(item: SouthConnectorItemDTO<I>): Promise<void> {
    if (!this.south) {
      return;
    }
    await this.deleteItem(item);
    await this.addItem(item);
  }

  deleteItem<I extends SouthItemSettings>(item: SouthConnectorItemDTO<I>) {
    if (!this.south) {
      return;
    }
    this.south.deleteItem(item);
  }

  deleteItems() {
    if (!this.south) {
      return;
    }
    this.south.deleteAllItems();
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }

  getMetricsDataStream(): PassThrough {
    return this._metricsService.stream;
  }
}
