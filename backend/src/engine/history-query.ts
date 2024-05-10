import path from 'node:path';
import { HistoryQueryDTO } from '../../../shared/model/history-query.model';
import { SouthConnectorDTO } from '../../../shared/model/south-connector.model';
import { NorthConnectorDTO } from '../../../shared/model/north-connector.model';

import { createFolder, delay } from '../service/utils';
import pino from 'pino';
import SouthService from '../service/south.service';
import NorthService from '../service/north.service';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import HistoryMetricsService from '../service/history-metrics.service';
import HistoryQueryService from '../service/history-query.service';
import { PassThrough } from 'node:stream';
import { SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { OIBusTimeValue } from '../../../shared/model/engine.model';

const FINISH_INTERVAL = 5000;

export default class HistoryQuery {
  protected readonly baseFolder: string;
  private north: NorthConnector<any> | null = null;
  private south: SouthConnector<any, any> | null = null;
  private finishInterval: NodeJS.Timeout | null = null;
  private readonly _metricsService: HistoryMetricsService;
  private stopping = false;

  constructor(
    private historyConfiguration: HistoryQueryDTO,
    private readonly southService: SouthService,
    private readonly northService: NorthService,
    private readonly historyService: HistoryQueryService,
    private logger: pino.Logger,
    baseFolder: string
  ) {
    this.baseFolder = baseFolder;
    this._metricsService = new HistoryMetricsService(
      historyConfiguration.id,
      this.historyService.repositoryService.southMetricsRepository,
      this.historyService.repositoryService.northMetricsRepository
    );
  }

  /**
   * Run history query according to its status
   */
  async start<S extends SouthSettings, N extends NorthSettings>(): Promise<void> {
    this.historyConfiguration = this.historyService.repositoryService.historyQueryRepository.getHistoryQuery(this.historyConfiguration.id)!;
    const southConfiguration: SouthConnectorDTO<S> = {
      id: this.historyConfiguration.id,
      name: this.historyConfiguration.name,
      description: '',
      enabled: true,
      history: this.historyConfiguration.history,
      type: this.historyConfiguration.southType,
      settings: this.historyConfiguration.southSettings,
      sharedConnection: this.historyConfiguration.southSharedConnection
    };
    const southFolder = path.resolve(this.baseFolder, 'south');
    await createFolder(southFolder);
    this.south = this.southService.createSouth(
      southConfiguration,
      this.addValues.bind(this),
      this.addFile.bind(this),
      southFolder,
      this.logger
    );
    const northConfiguration: NorthConnectorDTO<N> = {
      id: this.historyConfiguration.id,
      name: this.historyConfiguration.name,
      description: '',
      enabled: true,
      type: this.historyConfiguration.northType,
      settings: this.historyConfiguration.northSettings,
      caching: this.historyConfiguration.caching,
      archive: this.historyConfiguration.archive
    };
    const northFolder = path.resolve(this.baseFolder, 'north');
    await createFolder(northFolder);
    this.north = this.northService.createNorth(northConfiguration, northFolder, this.logger);

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

    if (this.historyConfiguration.status !== 'RUNNING') {
      this.logger.trace(`History Query "${this.historyConfiguration.name}" not enabled`);
      return;
    }

    await this.north.start(false);

    this.south.connectedEvent.on('connected', async () => {
      this.south!.createDeferredPromise();

      this.south!.historyQueryHandler(
        this.historyService.listItems(this.historyConfiguration.id, { enabled: true }),
        this.historyConfiguration.startTime,
        this.historyConfiguration.endTime,
        'history'
      )
        .then(() => {
          this.south!.resolveDeferredPromise();
        })
        .catch(async error => {
          this.logger.error(`Error while executing history query. ${error}`);
          this.south!.resolveDeferredPromise();
          await delay(FINISH_INTERVAL);
          this.historyConfiguration = this.historyService.repositoryService.historyQueryRepository.getHistoryQuery(
            this.historyConfiguration.id
          )!;
          if (this.historyConfiguration.status === 'RUNNING' && !this.stopping) {
            await this.south!.stop(false);
            await this.south!.start(false);
          }
        });
      if (this.finishInterval) {
        clearInterval(this.finishInterval);
      }
      this.finishInterval = setInterval(this.finish.bind(this), FINISH_INTERVAL);
    });
    await this.south.start(false);
  }

  /**
   * Add new values from a South connector to the Engine.
   * The Engine will forward the values to the Cache.
   */
  async addValues(_historyId: string, values: Array<OIBusTimeValue>): Promise<void> {
    if (this.north) {
      this.logger.info(`Add ${values.length} values from History Query "${this.historyConfiguration.name}" to north connector`);
      await this.north.cacheValues(values);
    }
  }

  /**
   * Add a new file from a South connector to the Engine.
   * The Engine will forward the file to the Cache.
   */
  async addFile(_historyId: string, filePath: string): Promise<void> {
    if (this.north) {
      this.logger.info(`Add file "${filePath}" from History Query "${this.historyConfiguration.name}" to north connector`);
      await this.north.cacheFile(filePath);
    }
  }

  /**
   * Stop history query
   */
  async stop(resetCache = false): Promise<void> {
    this.stopping = true;
    if (this.finishInterval) {
      clearInterval(this.finishInterval);
      this.finishInterval = null;
    }
    if (this.south) {
      this.south.connectedEvent.removeAllListeners();
      await this.south.stop(false);
      if (resetCache) {
        await this.south.resetCache();
      }
    }
    if (this.north) {
      await this.north.stop(false);
      if (resetCache) {
        await this.north.resetCache();
      }
    }
    // Also reset the metrics service
    if (this._metricsService && resetCache) {
      this._metricsService.resetMetrics();
    }
    this.stopping = false;
  }

  /**
   * Finish HistoryQuery.
   */
  async finish(): Promise<void> {
    if (!this.north || !this.south || ((await this.north.isCacheEmpty()) && !this.south.historyIsRunning)) {
      this.logger.info(`Finish "${this.historyConfiguration.name}" (${this.historyConfiguration.id})`);
      await this.stop();
      this.historyService.repositoryService.historyQueryRepository.setHistoryQueryStatus(this.historyConfiguration.id, 'FINISHED');
      this.historyConfiguration = this.historyService.repositoryService.historyQueryRepository.getHistoryQuery(
        this.historyConfiguration.id
      )!;
    } else {
      this.logger.debug(`History query "${this.historyConfiguration.name}" is still running`);
    }
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }

  getMetricsDataStream(): PassThrough {
    return this._metricsService.stream;
  }
}
