import fs from 'node:fs/promises';
import path from 'node:path';

import { createFolder, generateRandomId } from '../utils';
import pino from 'pino';

import { NorthCacheSettingsLightDTO } from '../../../../shared/model/north-connector.model';

const BUFFER_MAX = 250;
const BUFFER_TIMEOUT = 300;
// const RESEND_IMMEDIATELY_TIMEOUT = 100;

const VALUE_FOLDER = 'values';
const ERROR_FOLDER = 'values-errors';

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
export default class ValueCacheService {
  private readonly logger: pino.Logger;
  private readonly valueFolder: string;
  private readonly errorFolder: string;
  private readonly settings: NorthCacheSettingsLightDTO;

  private bufferTimeout: NodeJS.Timeout | undefined;
  private compactedQueue: Array<{ filename: string; createdAt: number; numberOfValues: number }> = []; // List of compact filename (randomId.compact.tmp)
  private bufferFiles: Map<string, Array<any>> = new Map(); // key: buffer filename (randomId.buffer.tmp, value: the values in the queue file)
  private queue: Map<string, Array<any>> = new Map(); // key: queue filename (randomId.queue.tmp, value: the values in the queue file)

  constructor(logger: pino.Logger, baseFolder: string, settings: NorthCacheSettingsLightDTO) {
    this.logger = logger;
    this.valueFolder = path.resolve(baseFolder, VALUE_FOLDER);
    this.errorFolder = path.resolve(baseFolder, ERROR_FOLDER);
    this.settings = settings;
  }

  /**
   * Create folders, read the cache folders to initialize the bufferFiles, queue and compactQueue
   * It also counts the values stored in the cache and log it.
   * If a file is corrupted or malformed, an error is logged and the file is ignored
   */
  async start(): Promise<void> {
    await createFolder(this.valueFolder);
    await createFolder(this.errorFolder);

    const files = await fs.readdir(this.valueFolder);

    // Take buffer.tmp file data into this.bufferFiles
    this.bufferFiles = new Map();
    const bufferFiles = files.filter(file => file.match(/.*.buffer.tmp/));
    for (const filename of bufferFiles) {
      try {
        const fileContent = await fs.readFile(path.resolve(this.valueFolder, filename), { encoding: 'utf8' });
        const values = JSON.parse(fileContent);
        this.bufferFiles.set(filename, values);
      } catch (error) {
        // If a file is being written or corrupted, the readFile method can fail
        // An error is logged and the cache goes through the other files
        this.logger.error(`Error while reading buffer file "${path.resolve(this.valueFolder, filename)}": ${error}`);
      }
    }

    let numberOfValuesInCache = 0;
    // Filters file that don't match the regex (keep queue.tmp files only)
    const queueFiles = files.filter(file => file.match(/.*.queue.tmp/));
    for (const filename of queueFiles) {
      try {
        const fileContent = await fs.readFile(path.resolve(this.valueFolder, filename), { encoding: 'utf8' });
        const values = JSON.parse(fileContent);
        this.queue.set(filename, values);
        numberOfValuesInCache += values.length;
      } catch (error) {
        // If a file is being written or corrupted, the readFile method can fail
        // An error is logged and the cache goes through the other files
        this.logger.error(`Error while reading queue file "${path.resolve(this.valueFolder, filename)}": ${error}`);
      }
    }

    // Filters file that don't match the regex (keep compact.tmp files only)
    const compactedQueueFiles = files.filter(file => file.match(/.*.compact.tmp/));
    this.compactedQueue = [];
    for (const filename of compactedQueueFiles) {
      try {
        const fileStat = await fs.stat(path.resolve(this.valueFolder, filename));
        const fileContent = await fs.readFile(path.resolve(this.valueFolder, filename), { encoding: 'utf8' });
        const values = JSON.parse(fileContent);
        this.compactedQueue.push({ filename, createdAt: fileStat.ctimeMs, numberOfValues: values.length });
        numberOfValuesInCache += values.length;
      } catch (error) {
        // If a file is being written or corrupted, the stat method can fail
        // An error is logged and the cache goes through the other files
        this.logger.error(`Error while reading compact file "${path.resolve(this.valueFolder, filename)}": ${error}`);
      }
    }

    // Sort the compact queue to have the oldest file first
    this.compactedQueue.sort((a, b) => a.createdAt - b.createdAt);
    if (numberOfValuesInCache > 0) {
      this.logger.info(`${numberOfValuesInCache} values in cache`);
    } else {
      this.logger.info('No value in cache');
    }
  }

  /**
   * Method used to flush the buffer from a time trigger or a max trigger
   * Flushing the buffer create a queue file and keep the values in memory for sending them
   */
  async flush(flag: 'time-flush' | 'max-flush' = 'time-flush'): Promise<void> {
    if (flag === 'max-flush') {
      clearTimeout(this.bufferTimeout);
    }
    // Reset timeout to null to set the buffer timeout again on the next send values
    this.bufferTimeout = undefined;

    const valuesInBufferFiles: Array<{ key: string; values: Array<any> }> = [];
    for (const [key, values] of this.bufferFiles.entries()) {
      valuesInBufferFiles.push({ key, values });
    }
    const valuesToFlush = valuesInBufferFiles.reduce((prev: Array<any>, { values }) => {
      prev.push(...values);
      return prev;
    }, []);
    const tmpFileName = `${generateRandomId()}.queue.tmp`;
    // Save the buffer to be sent and immediately clear it
    if (valuesToFlush.length === 0) {
      this.logger.trace(`Nothing to flush (${flag})`);
      return;
    }
    // Store the values in a tmp file
    try {
      await fs.writeFile(path.resolve(this.valueFolder, tmpFileName), JSON.stringify(valuesToFlush), { encoding: 'utf8', flag: 'w' });
    } catch (error) {
      this.logger.error(`Error while writing queue file ${path.resolve(this.valueFolder, tmpFileName)}: ${error}`);
      return; // Do not empty the buffer if the file could not be written
    }

    this.queue.set(tmpFileName, valuesToFlush);
    // Once compacted, remove values from queue.
    for (const { key } of valuesInBufferFiles) {
      this.bufferFiles.delete(key);
      try {
        await fs.unlink(path.resolve(this.valueFolder, key));
      } catch (error) {
        this.logger.error(`Error while removing buffer file ${path.resolve(this.valueFolder, key)}: ${error}`);
      }
    }

    let groupCount = 0;
    for (const values of this.queue.values()) {
      groupCount += values.length;
    }
    this.logger.trace(
      `Flush ${valuesToFlush.length} values (${flag}) into "${path.resolve(this.valueFolder, tmpFileName)}". ${groupCount} values in queue`
    );

    if (groupCount >= this.settings.maxSendCount) {
      const copiedQueue = this.queue;
      await this.compactQueueCache(copiedQueue);
    }
  }

  /**
   * Take values from the queue and store them in a compact file
   */
  async compactQueueCache(cacheQueue: Map<string, any>): Promise<void> {
    const valuesInQueue: Array<{ key: string; values: Array<any> }> = [];

    cacheQueue.forEach((values, key) => {
      valuesInQueue.push({ key, values });
    });
    const compactFilename = `${generateRandomId()}.compact.tmp`;
    this.logger.trace(`Max group count reach. Compacting queue into "${compactFilename}"`);
    try {
      const compactValues = valuesInQueue.reduce((prev: Array<any>, { values }) => {
        prev.push(...values);
        return prev;
      }, []);
      // Store the values in a tmp file
      await fs.writeFile(path.resolve(this.valueFolder, compactFilename), JSON.stringify(compactValues), { encoding: 'utf8', flag: 'w' });
      this.compactedQueue.push({
        filename: compactFilename,
        createdAt: new Date().getTime(),
        numberOfValues: compactValues.length
      });

      // Once compacted, remove values from queue.
      for (const { key } of valuesInQueue) {
        await this.deleteKeyFromCache(key);
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  /**
   * Retrieve the values from the queue or the compacted cache in form of an array of key, values where 'values' are the
   * values to send associated to the key (reference in the queue Map and filename where the data are persisted on disk)
   */
  async getValuesToSend(): Promise<Map<string, Array<any>>> {
    const valuesInQueue: Map<string, Array<any>> = new Map();
    // If there is no file in the compacted queue, the values are retrieved from the regular queue
    if (this.compactedQueue.length === 0) {
      this.logger.trace('Retrieving values from queue');
      this.queue.forEach((values, key) => {
        valuesInQueue.set(key, values);
      });
      return valuesInQueue;
    }

    // Otherwise, get the first element from the compacted queue and retrieve the values from the file
    const [queueFile] = this.compactedQueue;
    try {
      this.logger.trace(`Retrieving values from ${path.resolve(this.valueFolder, queueFile.filename)}.`);
      const fileContent = await fs.readFile(path.resolve(this.valueFolder, queueFile.filename), { encoding: 'utf8' });
      valuesInQueue.set(queueFile.filename, JSON.parse(fileContent));
    } catch (err) {
      this.logger.error(`Error while reading compacted file "${queueFile.filename}": ${err}`);
    }
    return valuesInQueue;
  }

  /**
   * Remove the values from the queue. The sent values are in an array of the form of key, values objects.
   * The key is the filename to remove from disk and the Map key to remove from the queue.
   * Values are not used in this case
   */
  async removeSentValues(sentValues: Map<string, Array<any>>): Promise<void> {
    for (const key of sentValues.keys()) {
      await this.deleteKeyFromCache(key);
    }
  }

  /**
   * Remove the key (filename) from the queues if it exists and remove the associated file
   */
  async deleteKeyFromCache(key: string): Promise<void> {
    // Remove values from queues
    const indexToRemove = this.compactedQueue.findIndex(queueFile => queueFile.filename === key);
    if (indexToRemove > -1) {
      this.compactedQueue.splice(indexToRemove, 1);
    }
    this.queue.delete(key);

    // Remove file from disk
    try {
      this.logger.trace(`Removing "${path.resolve(this.valueFolder, key)}" from cache`);
      await fs.unlink(path.resolve(this.valueFolder, key));
    } catch (err) {
      // Catch error locally to not block the removal of other files
      this.logger.error(`Error while removing file "${path.resolve(this.valueFolder, key)}" from cache: ${err}`);
    }
  }

  /**
   * Remove values from North connector cache and save them to the values error cache db
   */
  async manageErroredValues(values: Map<string, Array<any>>, errorCount: number): Promise<void> {
    for (const key of values.keys()) {
      // Remove values from queues
      const indexToRemove = this.compactedQueue.findIndex(queueFile => queueFile.filename === key);
      if (indexToRemove > -1) {
        this.compactedQueue.splice(indexToRemove, 1);
      }
      this.queue.delete(key);

      const filePath = path.parse(key);
      try {
        await fs.rename(path.resolve(this.valueFolder, key), path.resolve(this.errorFolder, filePath.base));
        this.logger.warn(
          `Values file "${path.resolve(this.valueFolder, key)}" moved to "${path.resolve(
            this.errorFolder,
            filePath.base
          )}" after ${errorCount} errors`
        );
      } catch (renameError) {
        // Catch error locally to let OIBus moving the other files.
        this.logger.error(
          `Error while moving values file "${path.resolve(this.valueFolder, key)}" into cache error ` +
            `"${path.resolve(this.errorFolder, filePath.base)}": ${renameError}`
        );
      }
    }
  }

  /**
   * Persist values into a tmp file and keep them in a local buffer to flush them in the queue later
   */
  async cacheValues(values: Array<any>): Promise<void> {
    const tmpFileName = `${generateRandomId()}.buffer.tmp`;

    // Immediately write the values into the buffer.tmp file to persist them on disk
    await fs.writeFile(path.resolve(this.valueFolder, tmpFileName), JSON.stringify(values), { encoding: 'utf8' });
    this.bufferFiles.set(tmpFileName, values);
    let numberOfValuesInBufferFiles = 0;
    for (const valuesInFile of this.bufferFiles.values()) {
      numberOfValuesInBufferFiles += valuesInFile.length;
    }
    if (numberOfValuesInBufferFiles > BUFFER_MAX) {
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
      files = await fs.readdir(this.valueFolder);
    } catch (error) {
      // Log an error if the folder does not exist (removed by the user while OIBus is running for example)
      this.logger.error(error);
    }
    return files.length === 0;
  }

  /**
   * Wait for cache to finish sending the values and clear the timers
   */
  async stop(): Promise<void> {
    clearTimeout(this.bufferTimeout);
    this.bufferTimeout = undefined;
  }
}
