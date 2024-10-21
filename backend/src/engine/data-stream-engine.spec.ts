import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';

import pino from 'pino';
import DataStreamEngine from './data-stream-engine';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createFolder, filesExists } from '../service/utils';
import testData from '../tests/utils/test-data';
import { OIBusRawContent, OIBusTimeValueContent } from '../../../shared/model/engine.model';
import NorthConnector from '../north/north-connector';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import SouthConnector from '../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import SouthConnectorMetricsRepository from '../repository/logs/south-connector-metrics.repository';
import SouthMetricsRepositoryMock from '../tests/__mocks__/repository/log/south-metrics-repository.mock';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';
import NorthMetricsRepositoryMock from '../tests/__mocks__/repository/log/north-metrics-repository.mock';
import NorthConnectorMetricsService from '../service/metrics/north-connector-metrics.service';
import NorthConnectorMetricsServiceMock from '../tests/__mocks__/service/metrics/north-connector-metrics-service.mock';
import SouthConnectorMetricsService from '../service/metrics/south-connector-metrics.service';
import SouthConnectorMetricsServiceMock from '../tests/__mocks__/service/metrics/south-connector-metrics-service.mock';

jest.mock('../south/south-mqtt/south-mqtt');
jest.mock('../service/south.service');
jest.mock('../service/north.service');
jest.mock('../service/repository.service');
jest.mock('../service/encryption.service');
jest.mock('../service/utils');
jest.mock('node:fs/promises');

const northConnectorMetricsService: NorthConnectorMetricsService = new NorthConnectorMetricsServiceMock();
jest.mock(
  '../service/metrics/north-connector-metrics.service',
  () =>
    function () {
      return northConnectorMetricsService;
    }
);

const southConnectorMetricsService: SouthConnectorMetricsService = new SouthConnectorMetricsServiceMock();
jest.mock(
  '../service/metrics/south-connector-metrics.service',
  () =>
    function () {
      return southConnectorMetricsService;
    }
);

const southConnectorMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const northConnectorMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

describe('DataStreamEngine', () => {
  let engine: DataStreamEngine;
  const mockedNorth1: NorthConnector<NorthSettings> = new NorthConnectorMock(testData.north.list[0]);
  const mockedNorth2: NorthConnector<NorthSettings> = new NorthConnectorMock(testData.north.list[1]);
  const mockedSouth1: SouthConnector<SouthSettings, SouthItemSettings> = new SouthConnectorMock(testData.south.list[0]);
  const mockedSouth2: SouthConnector<SouthSettings, SouthItemSettings> = new SouthConnectorMock(testData.south.list[1]);

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (logger.child as jest.Mock).mockReturnValue(logger);

    engine = new DataStreamEngine(northConnectorMetricsRepository, southConnectorMetricsRepository, logger);
  });

  afterEach(() => {
    mockedSouth1.connectedEvent.removeAllListeners();
    mockedSouth2.connectedEvent.removeAllListeners();
  });

  it('it should start and stop', async () => {
    (mockedNorth2.start as jest.Mock).mockImplementationOnce(() => {
      throw new Error('North error');
    });
    (mockedSouth2.start as jest.Mock).mockImplementationOnce(() => {
      throw new Error('South error');
    });

    mockedNorth2['settings']['enabled'] = true;
    mockedSouth2['settings']['enabled'] = true;
    await engine.start([mockedNorth1, mockedNorth2], [mockedSouth1, mockedSouth2]);

    expect(engine.logger).toBeDefined();
    expect(engine.baseFolder).toBeDefined();
    expect(logger.info).toHaveBeenCalledWith(`OIBus engine started`);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating North connector "${testData.north.list[1].name}" of type "${testData.north.list[1].type}" (${
        testData.north.list[1].id
      }): ${new Error('North error')}`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating South connector "${testData.south.list[1].name}" of type "${testData.south.list[1].type}" (${
        testData.south.list[1].id
      }): ${new Error('South error')}`
    );

    mockedSouth1.connectedEvent.emit('connected');
    expect(mockedSouth1.onItemChange).toHaveBeenCalled();

    await engine.stop();

    expect(mockedNorth1.stop).toHaveBeenCalledTimes(1);
  });

  it('should add content', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    (mockedNorth1.isSubscribed as jest.Mock).mockReturnValue(true);
    (mockedNorth1.isEnabled as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
    // Add time values
    await engine.addContent(testData.south.list[0].id, testData.oibusContent[0]);
    expect(mockedNorth1.cacheValues).not.toHaveBeenCalled();
    await engine.addContent(testData.south.list[0].id, testData.oibusContent[0]);
    expect(mockedNorth1.cacheValues).toHaveBeenCalledWith((testData.oibusContent[0] as OIBusTimeValueContent).content);

    (mockedNorth1.isEnabled as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
    // Add raw content
    await engine.addContent(testData.south.list[0].id, testData.oibusContent[1]);
    expect(mockedNorth1.cacheFile).not.toHaveBeenCalled();
    await engine.addContent(testData.south.list[0].id, testData.oibusContent[1]);
    expect(mockedNorth1.cacheFile).toHaveBeenCalledWith((testData.oibusContent[1] as OIBusRawContent).filePath);
  });

  it('should add external content', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    (mockedNorth1.isEnabled as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
    // Add time values
    await engine.addExternalContent(testData.north.list[0].id, testData.oibusContent[0]);
    expect(mockedNorth1.cacheValues).not.toHaveBeenCalled();
    await engine.addExternalContent(testData.north.list[0].id, testData.oibusContent[0]);
    expect(mockedNorth1.cacheValues).toHaveBeenCalledWith((testData.oibusContent[0] as OIBusTimeValueContent).content);

    (mockedNorth1.isEnabled as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
    // Add raw content
    await engine.addExternalContent(testData.north.list[0].id, testData.oibusContent[1]);
    expect(mockedNorth1.cacheFile).not.toHaveBeenCalled();
    await engine.addExternalContent(testData.north.list[0].id, testData.oibusContent[1]);
    expect(mockedNorth1.cacheFile).toHaveBeenCalledWith((testData.oibusContent[1] as OIBusRawContent).filePath);
  });

  it('should do nothing if connector not set', async () => {
    await engine.startSouth('bad id');
    expect(logger.trace).toHaveBeenCalledWith('South connector bad id not set');

    await engine.startNorth('bad id');
    expect(logger.trace).toHaveBeenCalledWith('North connector bad id not set');
  });

  it('should log error on start failure', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    (mockedSouth1.start as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('start fail')));
    (mockedNorth1.start as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('start fail')));

    await engine.startSouth(testData.south.list[0].id);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting South connector "${mockedSouth1.settings.name}" of type "${mockedSouth1.settings.type}" (${mockedSouth1.settings.id}): start fail`
    );
    await engine.startNorth(testData.north.list[0].id);

    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting North connector "${mockedNorth1.settings.name}" of type "${mockedNorth1.settings.type}" (${mockedNorth1.settings.id}): start fail`
    );
  });

  it('should set new logger', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    engine.setLogger(anotherLogger);

    expect(mockedSouth1.setLogger).toHaveBeenCalled();
    expect(anotherLogger.child).toHaveBeenCalledWith({
      scopeType: 'south',
      scopeId: testData.south.list[0].id,
      scopeName: testData.south.list[0].name
    });
    expect(mockedNorth1.setLogger).toHaveBeenCalled();
    expect(anotherLogger.child).toHaveBeenCalledWith({
      scopeType: 'north',
      scopeId: testData.north.list[0].id,
      scopeName: testData.north.list[0].name
    });
  });

  it('should delete south connector', async () => {
    (filesExists as jest.Mock).mockImplementationOnce(() => Promise.resolve(true)).mockImplementationOnce(() => Promise.resolve(false));
    const stopSouthSpy = jest.spyOn(engine, 'stopSouth');

    await engine.start([], [mockedSouth1, mockedSouth2]);

    const baseFolder = path.resolve('./cache/data-stream', `south-${mockedSouth1.settings.id}`);
    await engine.deleteSouth(testData.south.list[0]);

    expect(stopSouthSpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalledWith(baseFolder);
    expect(fs.rm).toHaveBeenCalledWith(baseFolder, { recursive: true });
    expect(logger.trace).toHaveBeenCalledWith(
      `Deleting base folder "${baseFolder}" of South connector "${mockedSouth1.settings.name}" (${mockedSouth1.settings.id})`
    );
    expect(logger.info).toHaveBeenCalledWith(`Deleted South connector "${mockedSouth1.settings.name}" (${mockedSouth1.settings.id})`);

    // Removing again should not call rm, meaning that it's actually removed
    await engine.deleteSouth(testData.south.list[0]);
    expect(fs.rm).toHaveBeenCalledTimes(1);
  });

  it('should delete north connector', async () => {
    (filesExists as jest.Mock).mockImplementationOnce(() => Promise.resolve(true)).mockImplementationOnce(() => Promise.resolve(false));
    const stopNorthSpy = jest.spyOn(engine, 'stopNorth');

    await engine.start([mockedNorth1, mockedNorth2], []);

    const baseFolder = path.resolve('./cache/data-stream', `north-${testData.north.list[0].id}`);
    await engine.deleteNorth(testData.north.list[0]);

    expect(stopNorthSpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalledWith(baseFolder);
    expect(fs.rm).toHaveBeenCalledWith(baseFolder, { recursive: true });
    expect(logger.trace).toHaveBeenCalledWith(
      `Deleting base folder "${baseFolder}" of North connector "${testData.north.list[0].name}" (${testData.north.list[0].id})`
    );
    expect(logger.info).toHaveBeenCalledWith(`Deleted North connector "${testData.north.list[0].name}" (${testData.north.list[0].id})`);

    // Removing again should not call rm, meaning that it's actually removed
    await engine.deleteNorth(testData.north.list[0]);
    expect(fs.rm).toHaveBeenCalledTimes(1);
  });

  it('should handle connector deletion errors', async () => {
    (filesExists as jest.Mock).mockImplementation(() => Promise.resolve(true));
    const stopSouthSpy = jest.spyOn(engine, 'stopSouth');
    const stopNorthSpy = jest.spyOn(engine, 'stopNorth');

    await engine.start([mockedNorth1, mockedNorth2], [mockedSouth1, mockedSouth2]);

    const error = new Error(`Can't remove folder`);
    (fs.rm as jest.Mock).mockImplementation(() => {
      throw error;
    });

    // South Connector error
    const southBaseFolder = path.resolve('./cache/data-stream', `south-${testData.south.list[0].id}`);
    await engine.deleteSouth(testData.south.list[0]);

    expect(stopSouthSpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(
      `Deleting base folder "${southBaseFolder}" of South connector "${testData.south.list[0].name}" (${testData.south.list[0].id})`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Unable to delete South connector "${testData.south.list[0].name}" (${testData.south.list[0].id} base folder: ${error}`
    );

    // North Connector error
    const northBaseFolder = path.resolve('./cache/data-stream', `north-${testData.north.list[0].id}`);
    await engine.deleteNorth(testData.north.list[0]);

    expect(stopNorthSpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(
      `Deleting base folder "${northBaseFolder}" of North connector "${testData.north.list[0].name}" (${testData.north.list[0].id})`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Unable to delete North connector "${testData.north.list[0].name}" (${testData.north.list[0].id}) base folder: ${error}`
    );
  });

  it('should manage error files', async () => {
    await engine.start([mockedNorth1], []);

    await engine.getErrorFiles('bad id', testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(mockedNorth1.getErrorFiles).not.toHaveBeenCalled();
    await engine.getErrorFiles(testData.north.list[0].id, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(mockedNorth1.getErrorFiles).toHaveBeenCalledWith(testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');

    await engine.getErrorFileContent('bad id', 'file');
    expect(mockedNorth1.getErrorFileContent).not.toHaveBeenCalled();
    await engine.getErrorFileContent(testData.north.list[0].id, 'file');
    expect(mockedNorth1.getErrorFileContent).toHaveBeenCalledWith('file');

    await engine.removeErrorFiles('bad id', ['file']);
    expect(mockedNorth1.removeErrorFiles).not.toHaveBeenCalled();
    await engine.removeErrorFiles(testData.north.list[0].id, ['file']);
    expect(mockedNorth1.removeErrorFiles).toHaveBeenCalledWith(['file']);

    await engine.retryErrorFiles('bad id', ['file']);
    expect(mockedNorth1.retryErrorFiles).not.toHaveBeenCalled();
    await engine.retryErrorFiles(testData.north.list[0].id, ['file']);
    expect(mockedNorth1.retryErrorFiles).toHaveBeenCalledWith(['file']);

    await engine.removeAllErrorFiles('bad id');
    expect(mockedNorth1.removeAllErrorFiles).not.toHaveBeenCalled();
    await engine.removeAllErrorFiles(testData.north.list[0].id);
    expect(mockedNorth1.removeAllErrorFiles).toHaveBeenCalled();

    await engine.retryAllErrorFiles('bad id');
    expect(mockedNorth1.retryAllErrorFiles).not.toHaveBeenCalled();
    await engine.retryAllErrorFiles(testData.north.list[0].id);
    expect(mockedNorth1.retryAllErrorFiles).toHaveBeenCalled();
  });

  it('should manage cache files', async () => {
    await engine.start([mockedNorth1], []);

    await engine.getCacheFiles('bad id', testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(mockedNorth1.getCacheFiles).not.toHaveBeenCalled();
    await engine.getCacheFiles(testData.north.list[0].id, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(mockedNorth1.getCacheFiles).toHaveBeenCalledWith(testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');

    await engine.getCacheFileContent('bad id', 'file');
    expect(mockedNorth1.getCacheFileContent).not.toHaveBeenCalled();
    await engine.getCacheFileContent(testData.north.list[0].id, 'file');
    expect(mockedNorth1.getCacheFileContent).toHaveBeenCalledWith('file');

    await engine.removeCacheFiles('bad id', ['file']);
    expect(mockedNorth1.removeCacheFiles).not.toHaveBeenCalled();
    await engine.removeCacheFiles(testData.north.list[0].id, ['file']);
    expect(mockedNorth1.removeCacheFiles).toHaveBeenCalledWith(['file']);

    await engine.archiveCacheFiles('bad id', ['file']);
    expect(mockedNorth1.archiveCacheFiles).not.toHaveBeenCalled();
    await engine.archiveCacheFiles(testData.north.list[0].id, ['file']);
    expect(mockedNorth1.archiveCacheFiles).toHaveBeenCalledWith(['file']);
  });

  it('should manage archive files', async () => {
    await engine.start([mockedNorth1], []);

    await engine.getArchiveFiles('bad id', testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(mockedNorth1.getArchiveFiles).not.toHaveBeenCalled();
    await engine.getArchiveFiles(testData.north.list[0].id, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(mockedNorth1.getArchiveFiles).toHaveBeenCalledWith(testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');

    await engine.getArchiveFileContent('bad id', 'file');
    expect(mockedNorth1.getArchiveFileContent).not.toHaveBeenCalled();
    await engine.getArchiveFileContent(testData.north.list[0].id, 'file');
    expect(mockedNorth1.getArchiveFileContent).toHaveBeenCalledWith('file');

    await engine.removeArchiveFiles('bad id', ['file']);
    expect(mockedNorth1.removeArchiveFiles).not.toHaveBeenCalled();
    await engine.removeArchiveFiles(testData.north.list[0].id, ['file']);
    expect(mockedNorth1.removeArchiveFiles).toHaveBeenCalledWith(['file']);

    await engine.retryArchiveFiles('bad id', ['file']);
    expect(mockedNorth1.retryArchiveFiles).not.toHaveBeenCalled();
    await engine.retryArchiveFiles(testData.north.list[0].id, ['file']);
    expect(mockedNorth1.retryArchiveFiles).toHaveBeenCalledWith(['file']);

    await engine.removeAllArchiveFiles('bad id');
    expect(mockedNorth1.removeAllArchiveFiles).not.toHaveBeenCalled();
    await engine.removeAllArchiveFiles(testData.north.list[0].id);
    expect(mockedNorth1.removeAllArchiveFiles).toHaveBeenCalledWith();

    await engine.retryAllArchiveFiles('bad id');
    expect(mockedNorth1.retryAllArchiveFiles).not.toHaveBeenCalled();
    await engine.retryAllArchiveFiles(testData.north.list[0].id);
    expect(mockedNorth1.retryAllArchiveFiles).toHaveBeenCalledWith();
  });

  it('should manage cache time-values', async () => {
    await engine.start([mockedNorth1], []);

    await engine.getCacheValues('bad id', 'file');
    expect(mockedNorth1.getCacheValues).not.toHaveBeenCalled();
    await engine.getCacheValues(testData.north.list[0].id, 'file');
    expect(mockedNorth1.getCacheValues).toHaveBeenCalledWith('file');

    await engine.removeCacheValues('bad id', ['file']);
    expect(mockedNorth1.removeCacheValues).not.toHaveBeenCalled();
    await engine.removeCacheValues(testData.north.list[0].id, ['file']);
    expect(mockedNorth1.removeCacheValues).toHaveBeenCalledWith(['file']);

    await engine.removeAllCacheValues('bad id');
    expect(mockedNorth1.removeAllCacheValues).not.toHaveBeenCalled();
    await engine.removeAllCacheValues(testData.north.list[0].id);
    expect(mockedNorth1.removeAllCacheValues).toHaveBeenCalledWith();
  });

  it('should manage error cache time-values', async () => {
    await engine.start([mockedNorth1], []);

    await engine.getValueErrors('bad id', testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(mockedNorth1.getValueErrors).not.toHaveBeenCalled();
    await engine.getValueErrors(testData.north.list[0].id, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(mockedNorth1.getValueErrors).toHaveBeenCalledWith(testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');

    await engine.removeValueErrors('bad id', ['file']);
    expect(mockedNorth1.removeValueErrors).not.toHaveBeenCalled();
    await engine.removeValueErrors(testData.north.list[0].id, ['file']);
    expect(mockedNorth1.removeValueErrors).toHaveBeenCalledWith(['file']);

    await engine.removeAllValueErrors('bad id');
    expect(mockedNorth1.removeAllValueErrors).not.toHaveBeenCalled();
    await engine.removeAllValueErrors(testData.north.list[0].id);
    expect(mockedNorth1.removeAllValueErrors).toHaveBeenCalledWith();

    await engine.retryValueErrors('bad id', ['file']);
    expect(mockedNorth1.retryValueErrors).not.toHaveBeenCalled();
    await engine.retryValueErrors(testData.north.list[0].id, ['file']);
    expect(mockedNorth1.retryValueErrors).toHaveBeenCalledWith(['file']);

    await engine.retryAllValueErrors('bad id');
    expect(mockedNorth1.retryAllValueErrors).not.toHaveBeenCalled();
    await engine.retryAllValueErrors(testData.north.list[0].id);
    expect(mockedNorth1.retryAllValueErrors).toHaveBeenCalledWith();
  });

  it('should manage item change', async () => {
    await engine.start([], [mockedSouth1]);

    await engine.reloadItems('bad id');
    expect(mockedSouth1.onItemChange).not.toHaveBeenCalled();
    await engine.reloadItems(testData.south.list[0].id);
    expect(mockedSouth1.onItemChange).toHaveBeenCalled();
  });

  it('should update north subscriptions', async () => {
    await engine.start([mockedNorth1, mockedNorth2], [mockedSouth1]);

    engine.updateSubscriptions();
    expect(mockedNorth1.updateConnectorSubscription).toHaveBeenCalledTimes(1);
    expect(mockedNorth2.updateConnectorSubscription).toHaveBeenCalledTimes(1);
  });

  it('should update north subscription', async () => {
    await engine.start([mockedNorth1, mockedNorth2], [mockedSouth1]);

    engine.updateSubscription(testData.north.list[0].id);
    expect(mockedNorth1.updateConnectorSubscription).toHaveBeenCalledTimes(1);
    expect(mockedNorth2.updateConnectorSubscription).toHaveBeenCalledTimes(0);
    engine.updateSubscription('bad id');
    expect(mockedNorth1.updateConnectorSubscription).toHaveBeenCalledTimes(1);
    expect(mockedNorth2.updateConnectorSubscription).toHaveBeenCalledTimes(0);
  });

  it('should update scan mode', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    await engine.updateScanMode(testData.scanMode.list[0]);
    expect(mockedSouth1.updateScanMode).toHaveBeenCalled();
    expect(mockedNorth1.updateScanMode).toHaveBeenCalled();
  });

  it('should properly reload', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    const startSouthSpy = jest.spyOn(engine, 'startSouth');
    const stopSouthSpy = jest.spyOn(engine, 'stopSouth');
    const startNorthSpy = jest.spyOn(engine, 'startNorth');
    const stopNorthSpy = jest.spyOn(engine, 'stopNorth');

    await engine.reloadNorth(testData.north.list[0]);
    expect(stopNorthSpy).toHaveBeenCalled();
    expect(startNorthSpy).toHaveBeenCalled();
    expect(logger.child).toHaveBeenCalledTimes(1);
    await engine.reloadNorth({ ...testData.north.list[0], id: 'bad id' });
    expect(logger.child).toHaveBeenCalledTimes(1);

    await engine.reloadSouth(testData.south.list[0]);
    expect(stopSouthSpy).toHaveBeenCalled();
    expect(startSouthSpy).toHaveBeenCalled();
    expect(logger.child).toHaveBeenCalledTimes(2);
    await engine.reloadSouth({ ...testData.south.list[0], id: 'bad id' });
    expect(logger.child).toHaveBeenCalledTimes(2);
  });

  it('should properly get stream', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    expect(engine.getNorthDataStream(mockedNorth1.settings.id)).not.toBeNull();
    expect(engine.getNorthDataStream('bad id')).toBeNull();

    expect(engine.getSouthDataStream(mockedSouth1.settings.id)).not.toBeNull();
    expect(engine.getSouthDataStream('bad id')).toBeNull();
  });

  it('should properly get metrics', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    expect(engine.getNorthConnectorMetrics()).toEqual({ [mockedNorth1.settings.id]: {} });
    expect(engine.getSouthConnectorMetrics()).toEqual({ [mockedSouth1.settings.id]: {} });
  });

  it('should properly reset metrics', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    engine.resetNorthConnectorMetrics(mockedNorth1.settings.id);
    engine.resetNorthConnectorMetrics('bad id');
    expect(northConnectorMetricsService.resetMetrics).toHaveBeenCalledTimes(1);

    engine.resetSouthConnectorMetrics(mockedSouth1.settings.id);
    engine.resetSouthConnectorMetrics('bad id');
    expect(southConnectorMetricsService.resetMetrics).toHaveBeenCalledTimes(1);
  });
});
