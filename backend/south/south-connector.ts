import path from 'node:path';
import { EventEmitter } from 'node:events';
import { CronJob } from 'cron';
import { createFolder, delay, generateIntervals } from '../service/utils';

import { SouthConnectorDTO, SouthConnectorManifest, SouthItemDTO } from '../../shared/model/south-connector.model';
import { ScanModeDTO } from '../../shared/model/scan-mode.model';
import { Instant } from '../../shared/model/types';
import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import ProxyService from '../service/proxy.service';
import RepositoryService from '../service/repository.service';
import DeferredPromise from '../service/deferred-promise';
import { DateTime } from 'luxon';

/**
 * Class SouthConnector : provides general attributes and methods for south connectors.
 * Building a new South connector means to extend this class, and to surcharge the following methods:
 * - **historyQuery**: receives a scanMode, a startTime and an endTime. Interval split can occur in this class. The
 * main logic must be developed in the surcharged method.
 * - **lastPointQuery**: receives a scanMode. The main logic must be developed in the surcharged method.
 * - **fileQuery**:  receives a scanMode. The main logic must be developed in the surcharged method.
 * - **subscribe**: A special scanMode is used (for example with MQTT). In this configuration, the driver will be able
 * to "listen" for updated values.
 * - **connect** (optional): to establish proper connection to the South connector
 * - **disconnect** (optional): to disconnect
 *
 * In addition, it is possible to use a number of helper functions:
 * - **addValues**: is an **important** method to be used when retrieving values. This will allow to push an array
 * of values to the engine to cache them
 * - **addFile**: is the equivalent of addValues but for a file.
 * - **logger**: to log an event with different levels (error,warning,info,debug,trace).
 *
 * All other operations (cache, store&forward, communication to North connectors) will be handled by the OIBus engine
 * and should not be taken care at the South level.
 */
export default class SouthConnector {
  protected configuration: SouthConnectorDTO;
  protected encryptionService: EncryptionService;
  protected proxyService: ProxyService;
  private repositoryService: RepositoryService;
  protected logger: pino.Logger;
  private readonly baseFolder: string;
  private manifest: SouthConnectorManifest;
  private readonly engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>;
  private readonly engineAddFileCallback: (southId: string, filePath: string) => Promise<void>;

  private itemsByScanModeIds: Map<string, Map<string, SouthItemDTO>> = new Map<string, Map<string, SouthItemDTO>>();
  private taskJobQueue: Array<ScanModeDTO> = [];
  private cronByScanModeIds: Map<string, CronJob> = new Map<string, CronJob>();
  private taskRunner: EventEmitter = new EventEmitter();
  private readonly streamMode: boolean;
  private stopping = false;
  private runProgress$: DeferredPromise | null = null;

  /**
   * Constructor for SouthConnector
   */
  constructor(
    configuration: SouthConnectorDTO,
    items: Array<SouthItemDTO>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string,
    streamMode: boolean,
    manifest: SouthConnectorManifest
  ) {
    this.configuration = configuration;
    items.forEach(item => {
      if (!this.itemsByScanModeIds.get(item.scanModeId)) {
        this.itemsByScanModeIds.set(item.scanModeId, new Map<string, SouthItemDTO>());
      }
      this.itemsByScanModeIds.get(item.scanModeId)!.set(item.id, item);
    });
    this.engineAddValuesCallback = engineAddValuesCallback;
    this.engineAddFileCallback = engineAddFileCallback;
    this.encryptionService = encryptionService;
    this.proxyService = proxyService;
    this.repositoryService = repositoryService;
    this.logger = logger;
    this.baseFolder = path.resolve(baseFolder, `south-${this.configuration.id}`);
    this.manifest = manifest;
    this.streamMode = streamMode;

    if (this.streamMode) {
      this.taskRunner.on('next', async () => {
        if (this.taskJobQueue.length > 0) {
          await this.run(this.taskJobQueue[0], true);
        } else {
          this.logger.trace('No more task to run');
        }
      });
    }
  }

  async start(): Promise<void> {
    await createFolder(this.baseFolder);

    if (!this.configuration.enabled) {
      this.logger.trace(`South connector ${this.configuration.name} not enabled`);
      return;
    }
    this.logger.trace(`South connector ${this.configuration.name} enabled. Starting services...`);
    await this.connect();
  }

  async connect(): Promise<void> {
    if (this.streamMode) {
      if (this.manifest.modes.subscription) {
        await this.subscribe([]);
      }

      for (const scanModeId of this.itemsByScanModeIds.keys()) {
        const scanMode = this.repositoryService.scanModeRepository.getScanMode(scanModeId);
        if (scanMode) {
          this.createCronJob(scanMode);
        } else {
          this.logger.error(`Scan mode ${scanModeId} not found.`);
        }
      }
    }
  }

  /**
   * Create a job used to populate the queue where each element of the queue is a job to call, associated to its scan mode
   */
  createCronJob(scanMode: ScanModeDTO): void {
    const existingCronJob = this.cronByScanModeIds.get(scanMode.id);
    if (existingCronJob) {
      existingCronJob.stop();
      this.cronByScanModeIds.delete(scanMode.id);
    }
    this.logger.trace(`Creating South cron job for scan mode "${scanMode.name}" (${scanMode.cron})`);
    const job = new CronJob(
      scanMode.cron,
      () => {
        this.addToQueue(scanMode);
      },
      null,
      true
    );
    this.cronByScanModeIds.set(scanMode.id, job);
  }

  addToQueue(scanMode: ScanModeDTO): void {
    const foundJob = this.taskJobQueue.find(element => element.id === scanMode.id);
    if (foundJob) {
      // If a job is already scheduled in queue, it will not be added
      this.logger.warn(`Task job not added in queue for cron "${scanMode.name}" (${scanMode.cron})`);
      return;
    }

    this.taskJobQueue.push(scanMode);
    if (this.taskJobQueue.length === 1) {
      this.taskRunner.emit('next');
    }
  }

  async run(scanMode: ScanModeDTO, streamMode: boolean): Promise<void> {
    if (this.runProgress$) {
      this.logger.warn(`A task is already running with scan mode ${scanMode.name}`);
      return;
    }
    this.runProgress$ = new DeferredPromise();
    const items = Array.from(this.itemsByScanModeIds.get(scanMode.id) || new Map(), ([_scanModeId, item]) => item);

    this.logger.trace(`Running South with scan mode ${scanMode.name} and ${items.length} items`);
    if (this.manifest.modes.historyFile || this.manifest.modes.historyPoint) {
      try {
        // TODO: get dates from last completed
        await this.historyQueryHandler(items, DateTime.fromISO('2023-02-19').toISO(), DateTime.fromISO('2023-02-20').toISO());
        // TODO: set last completed
      } catch (error) {
        this.logger.error(`Error when calling historyQuery ${error}`);
      }
    }
    if (this.manifest.modes.lastFile) {
      try {
        await this.fileQuery(items);
      } catch (error) {
        this.logger.error(`Error when calling fileQuery ${error}`);
      }
    }
    if (this.manifest.modes.lastPoint) {
      try {
        await this.lastPointQuery(items);
      } catch (error) {
        this.logger.error(`Error when calling lastPointQuery ${error}`);
      }
    }

    this.runProgress$.resolve();
    this.runProgress$ = null;

    if (streamMode && !this.stopping) {
      this.taskJobQueue.shift();
      this.taskRunner.emit('next');
    }
  }

  async historyQueryHandler(items: Array<SouthItemDTO>, startTime: Instant, endTime: Instant): Promise<void> {
    // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
    // requests. For example only one hour if maxReadInterval is 3600 (in s)
    const intervals = generateIntervals(startTime, endTime, this.configuration.settings.maxReadInterval);

    // TODO: filter already requested intervals

    for (const [index, interval] of intervals.entries()) {
      await this.historyQuery(items, interval.start, interval.end);

      // TODO: save last requested intervals
      if (index !== intervals.length - 1) {
        await delay(this.configuration.settings.readIntervalDelay);
      }
    }
  }

  async historyQuery(items: Array<SouthItemDTO>, startTime: Instant, endTime: Instant): Promise<void> {}
  async fileQuery(items: Array<SouthItemDTO>): Promise<void> {}
  async lastPointQuery(items: Array<SouthItemDTO>): Promise<void> {}
  async subscribe(items: Array<SouthItemDTO>): Promise<void> {}

  /**
   * Add new values to the South connector buffer.
   */
  async addValues(values: Array<any>): Promise<void> {
    if (values.length > 0) {
      this.logger.trace(`Add ${values.length} values to cache from South "${this.configuration.name}"`);
      await this.engineAddValuesCallback(this.configuration.id, values);
    }
  }

  /**
   * Add a new file to the Engine.
   */
  async addFile(filePath: string): Promise<void> {
    this.logger.trace(`Add file "${filePath}" to cache from South "${this.configuration.name}"`);
    await this.engineAddFileCallback(this.configuration.id, filePath);
  }

  /**
   * Method called by Engine to stop a South connector. This method can be surcharged in the
   * South connector implementation to allow disconnecting to a third party application for example.
   */
  async disconnect(): Promise<void> {
    this.logger.info(`South connector "${this.configuration.name}" (${this.configuration.id}) disconnected`);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.logger.info(`Stopping South "${this.configuration.name}" (${this.configuration.id})`);

    if (this.runProgress$) {
      await this.runProgress$.promise;
    }

    for (const cronJob of this.cronByScanModeIds.values()) {
      cronJob.stop();
    }
    this.cronByScanModeIds.clear();
    this.taskJobQueue = [];

    await this.disconnect();
    this.stopping = false;
  }
}
