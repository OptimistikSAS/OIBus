import fs from 'node:fs/promises';
import path from 'node:path';

import { createFolder, generateRandomId, getFilesFiltered } from '../utils';
import pino from 'pino';

import { NorthCacheFiles } from '../../../shared/model/north-connector.model';
import { EventEmitter } from 'node:events';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import { Instant } from '../../../shared/model/types';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { DateTime } from 'luxon';

const BUFFER_TIMEOUT = 300; // group temporary chunk files every 300ms
const VALUE_FOLDER = 'time-values';

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
export default class ValueCacheService {
  private _logger: pino.Logger;
  private readonly _cacheFolder: string;
  private readonly _errorFolder: string;
  private flushInProgress = false;
  private bufferTimeout: NodeJS.Timeout | undefined;
  private compactedQueue: Array<{ filename: string; createdAt: number }> = []; // List of compact filename (randomId.compact.tmp)
  private bufferFiles = new Map<string, Array<OIBusTimeValue>>(); // key: buffer filename (randomId.buffer.tmp, value: the values in the queue file)
  private queue = new Map<string, Array<OIBusTimeValue>>(); // key: queue filename (randomId.queue.tmp, value: the values in the queue file)
  private _triggerRun: EventEmitter = new EventEmitter();

  constructor(
    logger: pino.Logger,
    baseCacheFolder: string,
    baseErrorFolder: string,
    private _settings: NorthConnectorEntity<NorthSettings>
  ) {
    this._logger = logger;
    this._cacheFolder = path.resolve(baseCacheFolder, VALUE_FOLDER);
    this._errorFolder = path.resolve(baseErrorFolder, VALUE_FOLDER);
  }

  /**
   * Create folders, read the cache folders to initialize the bufferFiles, queue and compactQueue
   * It also counts the values stored in the cache and log it.
   * If a file is corrupted or malformed, an error is logged and the file is ignored
   */
  async start(): Promise<void> {
    await createFolder(this.cacheFolder);
    await createFolder(this.errorFolder);

    const files = await fs.readdir(this.cacheFolder);

    // Take buffer.tmp file data into this.bufferFiles
    this.bufferFiles = new Map();
    const bufferFiles = files.filter(file => file.match(/.*.buffer.tmp/));
    for (const filename of bufferFiles) {
      try {
        const fileContent = await fs.readFile(path.resolve(this.cacheFolder, filename), { encoding: 'utf8' });
        const values = JSON.parse(fileContent);
        this.bufferFiles.set(path.resolve(this.cacheFolder, filename), values);
      } catch (error: unknown) {
        // If a file is being written or corrupted, the readFile method can fail
        // An error is logged and the cache goes through the other files
        this._logger.error(`Error while reading buffer file "${path.resolve(this.cacheFolder, filename)}": ${(error as Error).message}`);
        await fs.rm(path.resolve(this.cacheFolder, filename), { force: true });
      }
    }

    let numberOfValuesInCache = 0;
    // Filters file that don't match the regex (keep queue.tmp files only)
    const queueFiles = files.filter(file => file.match(/.*.queue.tmp/));
    for (const filename of queueFiles) {
      try {
        const fileContent = await fs.readFile(path.resolve(this.cacheFolder, filename), { encoding: 'utf8' });
        const values = JSON.parse(fileContent);
        this.queue.set(path.resolve(this.cacheFolder, filename), values);
        numberOfValuesInCache += values.length;
      } catch (error: unknown) {
        // If a file is being written or corrupted, the readFile method can fail
        // An error is logged and the cache goes through the other files
        this._logger.error(`Error while reading queue file "${path.resolve(this.cacheFolder, filename)}": ${(error as Error).message}`);
        await fs.rm(path.resolve(this.cacheFolder, filename), { force: true });
      }
    }

    // Filters file that don't match the regex (keep compact.tmp files only)
    const compactedQueueFiles = files.filter(file => file.match(/.*.compact.tmp/));
    this.compactedQueue = [];
    for (const filename of compactedQueueFiles) {
      try {
        const fileStat = await fs.stat(path.resolve(this.cacheFolder, filename));
        this.compactedQueue.push({
          filename: path.resolve(this.cacheFolder, filename),
          createdAt: fileStat.ctimeMs
        });
      } catch (error: unknown) {
        // If a file is being written or corrupted, the stat method can fail
        // An error is logged and the cache goes through the other files
        this._logger.error(`Error while reading compact file "${path.resolve(this.cacheFolder, filename)}": ${(error as Error).message}`);
      }
    }

    // Sort the compact queue to have the oldest file first
    this.compactedQueue.sort((a, b) => a.createdAt - b.createdAt);
    if (numberOfValuesInCache > 0) {
      this._logger.debug(`${numberOfValuesInCache} values in queue and ${this.compactedQueue.length} compacted files in cache`);
    } else {
      this._logger.debug('No value in cache');
    }
  }

  /**
   * Method used to flush the buffer from a time trigger or a max trigger
   * Flushing the buffer create a queue file and keep the values in memory for sending them
   */
  private async flush(flag: 'time-flush' | 'max-flush' = 'time-flush'): Promise<void> {
    if (this.flushInProgress) {
      this._logger.trace(`Flush already in progress`);
      return;
    }
    this.flushInProgress = true;
    if (flag === 'max-flush') {
      clearTimeout(this.bufferTimeout);
    }

    const fileInBuffer: Array<string> = [];
    let valuesToFlush: Array<OIBusTimeValue> = [];

    for (const [key, values] of this.bufferFiles.entries()) {
      fileInBuffer.push(key);
      valuesToFlush = [...valuesToFlush, ...values];
    }

    if (valuesToFlush.length > 0) {
      // Store the values in a tmp file
      const tmpFileName = path.resolve(this.cacheFolder, `${generateRandomId()}.queue.tmp`);
      try {
        await fs.writeFile(tmpFileName, JSON.stringify(valuesToFlush), { encoding: 'utf8', flag: 'w' });
        const fileStat = await fs.stat(tmpFileName);
        this.triggerRun.emit('cache-size', { cacheSizeToAdd: fileStat.size, errorSizeToAdd: 0, archiveSizeToAdd: 0 });
        this.queue.set(tmpFileName, valuesToFlush);
        this._logger.trace(`Flush ${valuesToFlush.length} values (${flag}) into "${tmpFileName}"`);
      } catch (error: unknown) {
        this._logger.error(`Error while writing queue file "${tmpFileName}": ${(error as Error).message}`);
        this.flushInProgress = false;
        // Reset timeout to null to set the buffer timeout again on the next send values
        this.bufferTimeout = undefined;
        return; // Do not empty the buffer if the file could not be written
      }
    }

    // Once values in *.buffer.tmp files compacted into *queue.tmp file, remove values from queue.
    for (const key of fileInBuffer) {
      this.bufferFiles.delete(key);
      try {
        await fs.unlink(path.resolve(key));
      } catch (error: unknown) {
        this._logger.error(`Error while removing buffer file "${path.resolve(this.cacheFolder, key)}": ${(error as Error).message}`);
      }
    }

    let groupCount = 0;
    for (const values of this.queue.values()) {
      groupCount += values.length;
    }
    this._logger.trace(`${groupCount} values in queue`);

    if (groupCount >= this._settings.caching.oibusTimeValues.maxSendCount) {
      await this.compactQueueCache();
    }
    // Reset timeout to null to set the buffer timeout again on the next send values
    this.bufferTimeout = undefined;
    this.flushInProgress = false;
    if (groupCount >= this._settings.caching.oibusTimeValues.groupCount) {
      this.triggerRun.emit('next');
    }
  }

  /**
   * Take values from the queue and store them in a compact file
   */
  private async compactQueueCache(): Promise<void> {
    const fileInBuffer: Array<string> = [];
    let valuesInQueue: Array<OIBusTimeValue> = [];

    this.queue.forEach((values, key) => {
      fileInBuffer.push(key);
      valuesInQueue = [...valuesInQueue, ...values];
    });
    const compactFilename = path.resolve(this.cacheFolder, `${generateRandomId()}.compact.tmp`);
    this._logger.trace(`Max group count reach with ${valuesInQueue.length} values in queue. Compacting queue into "${compactFilename}"`);
    try {
      // Store the values in a tmp file
      await fs.writeFile(compactFilename, JSON.stringify(valuesInQueue), { encoding: 'utf8', flag: 'w' });
      const fileStat = await fs.stat(compactFilename);
      this.compactedQueue.push({
        filename: compactFilename,
        createdAt: new Date().getTime()
      });

      this.triggerRun.emit('cache-size', { cacheSizeToAdd: fileStat.size, errorSizeToAdd: 0, archiveSizeToAdd: 0 });

      // Once compacted, remove values from queue.
      for (const key of fileInBuffer) {
        await this.deleteKeyFromCache(key);
      }
    } catch (error: unknown) {
      this._logger.error(`Error while compacting queue files into "${compactFilename}": ${(error as Error).message}`);
    }
  }

  /**
   * Retrieve the values from the queue or the compacted cache in form of an array of key, values where 'values' are the
   * values to send associated to the key (reference in the queue Map and filename where the data are persisted on disk)
   */
  async getValuesToSend(): Promise<Map<string, Array<OIBusTimeValue>>> {
    const valuesInQueue = new Map<string, Array<OIBusTimeValue>>();
    // Get the first element from the compacted queue and retrieve the values from the file
    if (this.compactedQueue.length > 0) {
      const [queueFile] = this.compactedQueue;
      try {
        this._logger.trace(`Retrieving values from "${path.resolve(queueFile.filename)}"`);
        const fileContent = await fs.readFile(path.resolve(queueFile.filename), { encoding: 'utf8' });
        valuesInQueue.set(queueFile.filename, JSON.parse(fileContent));
      } catch (error: unknown) {
        this._logger.error(`Error while reading compacted file "${queueFile.filename}": ${(error as Error).message}`);
      }
      return valuesInQueue;
    }

    // If there is no file in the compacted queue, the values are retrieved from the regular queue
    this._logger.trace('Retrieving values from queue');
    this.queue.forEach((values, key) => {
      valuesInQueue.set(key, values);
      this.queue.delete(key); // remove the key (filename) from the queue to not compact it if it is being sent
    });
    return valuesInQueue;
  }

  /**
   * Remove the values from the queue. The values are in an array of the form of key, values objects.
   * The key is the filename to remove from disk and the Map key to remove from the queue.
   * Values are not used in this case
   */
  async removeSentValues(sentValues: Map<string, Array<OIBusTimeValue>>): Promise<void> {
    for (const key of sentValues.keys()) {
      await this.deleteKeyFromCache(key);
    }
  }

  /**
   * Remove all the values from the queue.
   * Values are not used in this case
   */
  async removeAllValues(): Promise<void> {
    await this.removeSentValues(this.queue);
  }

  /**
   * Remove the key (filename) from the queues if it exists and remove the associated file
   */
  private async deleteKeyFromCache(key: string): Promise<void> {
    // Remove values from queues
    const indexToRemove = this.compactedQueue.findIndex(queueFile => queueFile.filename === key);
    if (indexToRemove > -1) {
      this.compactedQueue.splice(indexToRemove, 1);
    }
    this.queue.delete(key);

    // Remove file from disk
    try {
      this._logger.trace(`Removing "${path.resolve(key)}" from cache`);
      const fileStat = await fs.stat(path.resolve(key));
      await fs.unlink(path.resolve(key));
      this.triggerRun.emit('cache-size', { cacheSizeToAdd: -fileStat.size, errorSizeToAdd: 0, archiveSizeToAdd: 0 });
    } catch (error: unknown) {
      // Catch error locally to not block the removal of other files
      this._logger.error(`Error while removing file "${path.resolve(key)}" from cache: ${(error as Error).message}`);
    }
  }

  /**
   * Remove values from North connector cache and save them to the values error cache db
   */
  async manageErroredValues(values: Map<string, Array<OIBusTimeValue>>, errorCount: number): Promise<void> {
    for (const key of values.keys()) {
      // Remove values from queues
      const indexToRemove = this.compactedQueue.findIndex(queueFile => queueFile.filename === key);
      if (indexToRemove > -1) {
        this.compactedQueue.splice(indexToRemove, 1);
      }
      this.queue.delete(key);

      const filePath = path.parse(key);
      try {
        const fileStat = await fs.stat(path.resolve(key));
        await fs.rename(path.resolve(key), path.resolve(this.errorFolder, filePath.base));
        this._logger.warn(
          `Values file "${path.resolve(key)}" moved to "${path.resolve(this.errorFolder, filePath.base)}" after ${errorCount} errors`
        );
        this.triggerRun.emit('cache-size', { cacheSizeToAdd: -fileStat.size, errorSizeToAdd: fileStat.size, archiveSizeToAdd: 0 });
      } catch (renameError: unknown) {
        // Catch error locally to let OIBus moving the other files.
        this._logger.error(
          `Error while moving values file "${path.resolve(key)}" into cache error ` +
            `"${path.resolve(this.errorFolder, filePath.base)}": ${(renameError as Error).message}`
        );
      }
    }
  }

  /**
   * Persist values into a tmp file and keep them in a local buffer to flush them in the queue later
   */
  async cacheValues(values: Array<OIBusTimeValue>): Promise<void> {
    const tmpFileName = path.resolve(this.cacheFolder, `${generateRandomId()}.buffer.tmp`);

    // Immediately write the values into the buffer.tmp file to persist them on disk
    await fs.writeFile(tmpFileName, JSON.stringify(values), { encoding: 'utf8' });
    this.bufferFiles.set(tmpFileName, values);
    let numberOfValuesInBufferFiles = 0;
    for (const valuesInFile of this.bufferFiles.values()) {
      numberOfValuesInBufferFiles += valuesInFile.length;
    }
    if (numberOfValuesInBufferFiles > this._settings.caching.oibusTimeValues.groupCount) {
      await this.flush('max-flush');
    } else if (!this.bufferTimeout) {
      this.bufferTimeout = setTimeout(this.flush.bind(this), BUFFER_TIMEOUT);
    }
  }

  /**
   * Check if the value cache is empty or not
   */
  async isEmpty(): Promise<boolean> {
    let files = [];
    try {
      files = await fs.readdir(this.cacheFolder);
    } catch (error) {
      // Log an error if the folder does not exist (removed by the user while OIBus is running for example)
      this._logger.error(error);
    }
    return files.length === 0;
  }

  /**
   * Returns metadata about files in the current queue.
   */
  getQueuedFilesMetadata(fileNameContains: string): Array<NorthCacheFiles> {
    return [...this.queue.entries()]
      .map(([filepath, value]) => ({
        filename: path.basename(filepath),
        size: JSON.stringify(value).length,
        modificationDate: DateTime.now().toUTC().toISO()
      }))
      .filter(file => file.filename.toUpperCase().includes(fileNameContains.toUpperCase()));
  }

  /**
   * Returns metadata about error value files.
   */
  async getErrorValues(fromDate: Instant | null, toDate: Instant | null, nameFilter: string | null): Promise<Array<NorthCacheFiles>> {
    return await getFilesFiltered(this.errorFolder, fromDate, toDate, nameFilter, this._logger);
  }

  /**
   * Remove error value files.
   */
  async removeErrorValues(filenames: Array<string>): Promise<void> {
    for (const filename of filenames) {
      const filePath = path.join(this.errorFolder, filename);
      // Remove file from disk
      try {
        this._logger.trace(`Removing "${path.resolve(filePath)}" from error cache`);
        const fileStat = await fs.stat(path.resolve(filePath));
        await fs.unlink(path.resolve(filePath));
        this.triggerRun.emit('cache-size', { cacheSizeToAdd: 0, errorSizeToAdd: -fileStat.size, archiveSizeToAdd: 0 });
      } catch (error: unknown) {
        // Catch error locally to not block the removal of other files
        this._logger.error(`Error while removing file "${path.resolve(filePath)}" from error cache: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Remove all error value files.
   */
  async removeAllErrorValues(): Promise<void> {
    const filenames = await fs.readdir(this.errorFolder);
    if (filenames.length > 0) {
      this._logger.debug(`Removing ${filenames.length} files from "${this.errorFolder}"`);
      await this.removeErrorValues(filenames);
    } else {
      this._logger.debug(`The error value folder "${this.errorFolder}" is empty. Nothing to delete`);
    }
  }

  /**
   * Retry error value files.
   */
  async retryErrorValues(filenames: Array<string>): Promise<void> {
    for (const filename of filenames) {
      const filePath = path.join(this.errorFolder, filename);

      try {
        const fileContent = await fs.readFile(filePath, { encoding: 'utf8' });
        const values = JSON.parse(fileContent);
        await this.cacheValues(values);
      } catch (error: unknown) {
        this._logger.error(`Error while reading error value file "${filePath}": ${(error as Error).message}`);
        continue;
      }
      await this.removeErrorValues([filename]);
    }
  }

  /**
   * Retry all error value files.
   */
  async retryAllErrorValues(): Promise<void> {
    const filenames = await fs.readdir(this.errorFolder);
    if (filenames.length > 0) {
      this._logger.debug(`Retrying ${filenames.length} files from "${this.errorFolder}"`);
      await this.retryErrorValues(filenames);
    } else {
      this._logger.debug(`The error value folder "${this.errorFolder}" is empty. Nothing to retry`);
    }
  }

  /**
   * Wait for cache to finish sending the values and clear the timers
   */
  async stop(): Promise<void> {
    clearTimeout(this.bufferTimeout);
    this.bufferTimeout = undefined;
  }

  setLogger(value: pino.Logger) {
    this._logger = value;
  }

  get triggerRun(): EventEmitter {
    return this._triggerRun;
  }

  set settings(value: NorthConnectorEntity<NorthSettings>) {
    this._settings = value;
  }

  get errorFolder(): string {
    return this._errorFolder;
  }

  get cacheFolder(): string {
    return this._cacheFolder;
  }
}
