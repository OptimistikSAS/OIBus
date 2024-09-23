import path from 'node:path';

import { createFolder, delay } from '../service/utils';
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
import { OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity } from '../model/south-connector.model';
import { NorthConnectorEntity } from '../model/north-connector.model';
import RepositoryService from '../service/repository.service';
import { HistoryQueryEntity } from '../model/histor-query.model';

const FINISH_INTERVAL = 5000;

export default class HistoryQuery {
  protected readonly baseFolder: string;
  private north: NorthConnector<NorthSettings> | null = null;
  private south: SouthConnector<SouthSettings, SouthItemSettings> | null = null;
  private finishInterval: NodeJS.Timeout | null = null;
  private readonly _metricsService: HistoryMetricsService;
  private stopping = false;

  constructor(
    private historyConfiguration: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>,
    private readonly southService: SouthService,
    private readonly northService: NorthService,
    private readonly historyService: HistoryQueryService,
    private readonly repositoryService: RepositoryService,
    private logger: pino.Logger,
    baseFolder: string
  ) {
    this.baseFolder = baseFolder;
    this._metricsService = new HistoryMetricsService(
      historyConfiguration.id,
      this.repositoryService.southMetricsRepository,
      this.repositoryService.northMetricsRepository
    );
  }

  async start(): Promise<void> {
    this.historyConfiguration = this.repositoryService.historyQueryRepository.findHistoryQueryById(this.historyConfiguration.id)!;
    const southConfiguration: SouthConnectorEntity<SouthSettings, SouthItemSettings> = {
      id: this.historyConfiguration.id,
      name: this.historyConfiguration.name,
      description: '',
      enabled: true,
      history: { ...this.historyConfiguration.history, overlap: 0 },
      type: this.historyConfiguration.southType,
      settings: this.historyConfiguration.southSettings,
      sharedConnection: this.historyConfiguration.southSharedConnection,
      items: []
    };
    const southFolder = path.resolve(this.baseFolder, 'south');
    await createFolder(southFolder);
    this.south = this.southService.runSouth(southConfiguration, this.addContent.bind(this), southFolder, this.logger);
    const northConfiguration: NorthConnectorEntity<NorthSettings> = {
      id: this.historyConfiguration.id,
      name: this.historyConfiguration.name,
      description: '',
      enabled: true,
      type: this.historyConfiguration.northType,
      settings: this.historyConfiguration.northSettings,
      caching: this.historyConfiguration.caching,
      subscriptions: []
    };
    const northFolder = path.resolve(this.baseFolder, 'north');
    await createFolder(northFolder);
    this.north = this.northService.runNorth(northConfiguration, northFolder, this.logger);

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
        this.historyConfiguration.items.map(item => ({ ...item, scanModeId: 'history' })),
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
          this.historyConfiguration = this.repositoryService.historyQueryRepository.findHistoryQueryById(this.historyConfiguration.id)!;
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

  async addContent(_historyId: string, data: OIBusContent) {
    if (this.north) {
      switch (data.type) {
        case 'time-values':
          this.logger.info(`Add ${data.content.length} values from History Query "${this.historyConfiguration.name}" to north connector`);
          return await this.north.cacheValues(data.content);
        case 'raw':
          this.logger.info(`Add file "${data.filePath}" from History Query "${this.historyConfiguration.name}" to north connector`);
          return await this.north.cacheFile(data.filePath);
      }
    }
  }

  /**
   * Stop history query
   */
  async stop(): Promise<void> {
    this.stopping = true;
    if (this.finishInterval) {
      clearInterval(this.finishInterval);
      this.finishInterval = null;
    }
    if (this.south) {
      this.south.connectedEvent.removeAllListeners();
      await this.south.stop(false);
    }
    if (this.north) {
      await this.north.stop(false);
    }
    this.stopping = false;
  }

  async resetCache(): Promise<void> {
    if (this.south) {
      await this.south.resetCache();
    }
    if (this.north) {
      await this.north.resetCache();
    }
    if (this._metricsService) {
      this._metricsService.resetMetrics();
    }
  }

  /**
   * Finish HistoryQuery.
   */
  async finish(): Promise<void> {
    if (!this.north || !this.south || ((await this.north.isCacheEmpty()) && !this.south.historyIsRunning)) {
      this.logger.info(`Finish "${this.historyConfiguration.name}" (${this.historyConfiguration.id})`);
      await this.stop();
      this.repositoryService.historyQueryRepository.updateHistoryQueryStatus(this.historyConfiguration.id, 'FINISHED');
      this.historyConfiguration = this.repositoryService.historyQueryRepository.findHistoryQueryById(this.historyConfiguration.id)!;
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
