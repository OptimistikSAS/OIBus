import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import OIBusEngine from './oibus-engine';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { filesExists } from '../service/utils';
import testData from '../tests/utils/test-data';
import RepositoryService from '../service/repository.service';
import RepositoryServiceMock from '../tests/__mocks__/service/repository-service.mock';
import { OIBusRawContent, OIBusTimeValueContent } from '../../../shared/model/engine.model';

jest.mock('../south/south-mqtt/south-mqtt');
jest.mock('../service/south.service');
jest.mock('../service/north.service');
jest.mock('../service/repository.service');
jest.mock('../service/encryption.service');
jest.mock('../service/utils');
jest.mock('node:fs/promises');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();

let engine: OIBusEngine;

const connectedEvent = new EventEmitter();

const createdSouth = {
  start: jest.fn().mockImplementation(() => Promise.resolve()),
  stop: jest.fn(),
  connect: jest.fn(),
  historyQueryHandler: jest.fn(),
  isEnabled: jest.fn(),
  setLogger: jest.fn(),
  updateScanMode: jest.fn(),
  getMetricsDataStream: jest.fn(),
  resetMetrics: jest.fn(),
  onItemChange: jest.fn(),
  settings: { id: 'id1', name: 'South Connector1', type: 'sqlite' },
  connectedEvent: connectedEvent
};
const createdNorth = {
  start: jest.fn().mockImplementation(() => Promise.resolve()),
  stop: jest.fn(),
  connect: jest.fn(),
  isEnabled: jest.fn(),
  cacheValues: jest.fn(),
  cacheFile: jest.fn(),
  isSubscribed: jest.fn(),
  setLogger: jest.fn(),
  updateScanMode: jest.fn(),
  getErrorFiles: jest.fn(),
  getErrorFileContent: jest.fn(),
  removeErrorFiles: jest.fn(),
  retryErrorFiles: jest.fn(),
  removeAllErrorFiles: jest.fn(),
  retryAllErrorFiles: jest.fn(),
  getCacheFiles: jest.fn(),
  getCacheFileContent: jest.fn(),
  removeCacheFiles: jest.fn(),
  archiveCacheFiles: jest.fn(),
  getArchiveFiles: jest.fn(),
  getArchiveFileContent: jest.fn(),
  removeArchiveFiles: jest.fn(),
  retryArchiveFiles: jest.fn(),
  removeAllArchiveFiles: jest.fn(),
  retryAllArchiveFiles: jest.fn(),
  getMetricsDataStream: jest.fn(),
  resetMetrics: jest.fn(),
  getCacheValues: jest.fn(),
  removeCacheValues: jest.fn(),
  removeAllCacheValues: jest.fn(),
  getValueErrors: jest.fn(),
  removeValueErrors: jest.fn(),
  removeAllValueErrors: jest.fn(),
  retryValueErrors: jest.fn(),
  retryAllValueErrors: jest.fn(),
  updateConnectorSubscription: jest.fn(),
  settings: { id: 'id1', name: 'myNorthConnector1', type: 'oianalytics' }
};

describe('OIBusEngine', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (northService.findAll as jest.Mock).mockReturnValue(testData.north.list);
    (southService.findAll as jest.Mock).mockReturnValue(testData.south.list);
    (northService.findById as jest.Mock).mockImplementation(id => testData.north.list.find(element => element.id === id));
    (southService.findById as jest.Mock).mockImplementation(id => testData.south.list.find(element => element.id === id));
    (southService.runSouth as jest.Mock).mockImplementation(() => createdSouth);
    (northService.runNorth as jest.Mock).mockImplementation(() => createdNorth);

    engine = new OIBusEngine(encryptionService, northService, southService, repositoryService, logger);
  });

  it('it should start and stop', async () => {
    (southService.runSouth as jest.Mock)
      .mockImplementationOnce(() => createdSouth)
      .mockImplementationOnce(() => {
        throw new Error('error');
      });
    (northService.runNorth as jest.Mock)
      .mockImplementationOnce(() => createdNorth)
      .mockImplementationOnce(() => {
        throw new Error('error');
      });

    await engine.start();

    expect(logger.info).toHaveBeenCalledWith(`OIBus engine started`);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating North connector "${testData.north.list[1].name}" of type "${testData.north.list[1].type}" (${
        testData.north.list[1].id
      }): ${new Error('error')}`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating South connector "${testData.south.list[1].name}" of type "${testData.south.list[1].type}" (${
        testData.south.list[1].id
      }): ${new Error('error')}`
    );

    createdSouth.connectedEvent.emit('connected');
    expect(createdSouth.onItemChange).toHaveBeenCalled();

    await engine.stop();

    expect(createdNorth.stop).toHaveBeenCalledTimes(1);
    expect(createdSouth.stop).toHaveBeenCalledTimes(2);
  });

  it('should add content', async () => {
    await engine.start();

    createdNorth.isSubscribed.mockReturnValue(true);
    createdNorth.isEnabled.mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValueOnce(true).mockReturnValueOnce(true);
    // Add time values
    await engine.addContent('southId', testData.oibusContent[0]);
    expect(createdNorth.cacheValues).not.toHaveBeenCalled();
    await engine.addContent('southId', testData.oibusContent[0]);
    expect(createdNorth.cacheValues).toHaveBeenCalledWith((testData.oibusContent[0] as OIBusTimeValueContent).content);

    createdNorth.isEnabled.mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValueOnce(true).mockReturnValueOnce(true);
    // Add raw content
    await engine.addContent('southId', testData.oibusContent[1]);
    expect(createdNorth.cacheFile).not.toHaveBeenCalled();
    await engine.addContent('southId', testData.oibusContent[1]);
    expect(createdNorth.cacheFile).toHaveBeenCalledWith((testData.oibusContent[1] as OIBusRawContent).filePath);
  });

  it('should add external content', async () => {
    await engine.start();

    createdNorth.isEnabled.mockReturnValueOnce(false).mockReturnValueOnce(true);
    // Add time values
    await engine.addExternalContent(testData.north.list[0].id, testData.oibusContent[0]);
    expect(createdNorth.cacheValues).not.toHaveBeenCalled();
    await engine.addExternalContent(testData.north.list[0].id, testData.oibusContent[0]);
    expect(createdNorth.cacheValues).toHaveBeenCalledWith((testData.oibusContent[0] as OIBusTimeValueContent).content);

    createdNorth.isEnabled.mockReturnValueOnce(false).mockReturnValueOnce(true);
    // Add raw content
    await engine.addExternalContent(testData.north.list[0].id, testData.oibusContent[1]);
    expect(createdNorth.cacheFile).not.toHaveBeenCalled();
    await engine.addExternalContent(testData.north.list[0].id, testData.oibusContent[1]);
    expect(createdNorth.cacheFile).toHaveBeenCalledWith((testData.oibusContent[1] as OIBusRawContent).filePath);
  });

  it('should do nothing if connector not set', async () => {
    await engine.startSouth('bad id');
    expect(logger.trace).toHaveBeenCalledWith('South connector bad id not set');

    await engine.startNorth('bad id');
    expect(logger.trace).toHaveBeenCalledWith('North connector bad id not set');
  });

  it('should log error on start failure', async () => {
    await engine.start();

    createdSouth.start.mockImplementationOnce(() => Promise.reject(new Error('start fail')));
    createdNorth.start.mockImplementationOnce(() => Promise.reject(new Error('start fail')));

    await engine.startSouth(testData.south.list[0].id);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting South connector "${createdSouth.settings.name}" of type "${createdSouth.settings.type}" (${createdSouth.settings.id}): start fail`
    );
    await engine.startNorth(testData.north.list[0].id);

    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting North connector "${createdNorth.settings.name}" of type "${createdNorth.settings.type}" (${createdNorth.settings.id}): start fail`
    );
  });

  it('should set new logger', async () => {
    await engine.start();

    engine.setLogger(anotherLogger);

    expect(createdSouth.setLogger).toHaveBeenCalled();
    expect(anotherLogger.child).toHaveBeenCalledWith({
      scopeType: 'south',
      scopeId: testData.south.list[0].id,
      scopeName: testData.south.list[0].name
    });
    expect(createdNorth.setLogger).toHaveBeenCalled();
    expect(anotherLogger.child).toHaveBeenCalledWith({
      scopeType: 'north',
      scopeId: testData.north.list[0].id,
      scopeName: testData.north.list[0].name
    });
  });

  it('should delete south connector', async () => {
    (filesExists as jest.Mock).mockImplementationOnce(() => Promise.resolve(true)).mockImplementationOnce(() => Promise.resolve(false));
    const stopSouthSpy = jest.spyOn(engine, 'stopSouth');

    (northService.findAll as jest.Mock).mockReturnValue([]);
    (southService.findAll as jest.Mock).mockReturnValue(testData.south.list);
    (southService.runSouth as jest.Mock).mockReturnValue(createdSouth);
    await engine.start();

    const southId = testData.south.list[0].id;
    const name = testData.south.list[0].name;
    const baseFolder = path.resolve('./cache/data-stream', `south-${southId}`);
    await engine.deleteSouth(southId, name);

    expect(stopSouthSpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalledWith(baseFolder);
    expect(fs.rm).toHaveBeenCalledWith(baseFolder, { recursive: true });
    expect(logger.trace).toHaveBeenCalledWith(`Deleting base folder "${baseFolder}" of South connector "${name}" (${southId})`);
    expect(logger.info).toHaveBeenCalledWith(`Deleted South connector "${name}" (${southId})`);

    // Removing again should not call rm, meaning that it's actually removed
    await engine.deleteSouth(southId, name);
    expect(fs.rm).toHaveBeenCalledTimes(1);
  });

  it('should delete north connector', async () => {
    (filesExists as jest.Mock).mockImplementationOnce(() => Promise.resolve(true)).mockImplementationOnce(() => Promise.resolve(false));
    const stopNorthSpy = jest.spyOn(engine, 'stopNorth');

    (southService.findAll as jest.Mock).mockReturnValue([]);
    (northService.findAll as jest.Mock).mockReturnValue(testData.north.list);
    (northService.runNorth as jest.Mock).mockReturnValue(createdNorth);
    await engine.start();

    const northId = testData.north.list[0].id;
    const name = testData.north.list[0].name;
    const baseFolder = path.resolve('./cache/data-stream', `north-${northId}`);
    await engine.deleteNorth(northId, name);

    expect(stopNorthSpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalledWith(baseFolder);
    expect(fs.rm).toHaveBeenCalledWith(baseFolder, { recursive: true });
    expect(logger.trace).toHaveBeenCalledWith(`Deleting base folder "${baseFolder}" of North connector "${name}" (${northId})`);
    expect(logger.info).toHaveBeenCalledWith(`Deleted North connector "${name}" (${northId})`);

    // Removing again should not call rm, meaning that it's actually removed
    await engine.deleteNorth(northId, name);
    expect(fs.rm).toHaveBeenCalledTimes(1);
  });

  it('should handle connector deletion errors', async () => {
    (filesExists as jest.Mock).mockImplementation(() => Promise.resolve(true));
    const stopSouthSpy = jest.spyOn(engine, 'stopSouth');
    const stopNorthSpy = jest.spyOn(engine, 'stopNorth');

    (southService.findAll as jest.Mock).mockReturnValue(testData.south.list);
    (southService.runSouth as jest.Mock).mockReturnValue(createdSouth);
    (northService.findAll as jest.Mock).mockReturnValue(testData.north.list);
    (northService.runNorth as jest.Mock).mockReturnValue(createdNorth);
    await engine.start();

    const error = new Error(`Can't remove folder`);
    (fs.rm as jest.Mock).mockImplementation(() => {
      throw error;
    });

    // South Connector error
    const southId = testData.south.list[0].id;
    const southName = testData.south.list[0].name;
    const southBaseFolder = path.resolve('./cache/data-stream', `south-${southId}`);
    await engine.deleteSouth(southId, southName);

    expect(stopSouthSpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Deleting base folder "${southBaseFolder}" of South connector "${southName}" (${southId})`);
    expect(logger.error).toHaveBeenCalledWith(`Unable to delete South connector "${southName}" (${southId} base folder: ${error}`);

    // North Connector error
    const northId = testData.north.list[0].id;
    const northName = testData.north.list[0].name;
    const northBaseFolder = path.resolve('./cache/data-stream', `north-${northId}`);
    await engine.deleteNorth(northId, northName);

    expect(stopNorthSpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Deleting base folder "${northBaseFolder}" of North connector "${northName}" (${northId})`);
    expect(logger.error).toHaveBeenCalledWith(`Unable to delete North connector "${northName}" (${northId}) base folder: ${error}`);
  });

  it('should manage error files', async () => {
    await engine.start();

    await engine.getErrorFiles('bad id', testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(createdNorth.getErrorFiles).not.toHaveBeenCalled();
    await engine.getErrorFiles(testData.north.list[0].id, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(createdNorth.getErrorFiles).toHaveBeenCalledWith(testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');

    await engine.getErrorFileContent('bad id', 'file');
    expect(createdNorth.getErrorFileContent).not.toHaveBeenCalled();
    await engine.getErrorFileContent(testData.north.list[0].id, 'file');
    expect(createdNorth.getErrorFileContent).toHaveBeenCalledWith('file');

    await engine.removeErrorFiles('bad id', ['file']);
    expect(createdNorth.removeErrorFiles).not.toHaveBeenCalled();
    await engine.removeErrorFiles(testData.north.list[0].id, ['file']);
    expect(createdNorth.removeErrorFiles).toHaveBeenCalledWith(['file']);

    await engine.retryErrorFiles('bad id', ['file']);
    expect(createdNorth.retryErrorFiles).not.toHaveBeenCalled();
    await engine.retryErrorFiles(testData.north.list[0].id, ['file']);
    expect(createdNorth.retryErrorFiles).toHaveBeenCalledWith(['file']);

    await engine.removeAllErrorFiles('bad id');
    expect(createdNorth.removeAllErrorFiles).not.toHaveBeenCalled();
    await engine.removeAllErrorFiles(testData.north.list[0].id);
    expect(createdNorth.removeAllErrorFiles).toHaveBeenCalled();

    await engine.retryAllErrorFiles('bad id');
    expect(createdNorth.retryAllErrorFiles).not.toHaveBeenCalled();
    await engine.retryAllErrorFiles(testData.north.list[0].id);
    expect(createdNorth.retryAllErrorFiles).toHaveBeenCalled();
  });

  it('should manage cache files', async () => {
    await engine.start();

    await engine.getCacheFiles('bad id', testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(createdNorth.getCacheFiles).not.toHaveBeenCalled();
    await engine.getCacheFiles(testData.north.list[0].id, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(createdNorth.getCacheFiles).toHaveBeenCalledWith(testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');

    await engine.getCacheFileContent('bad id', 'file');
    expect(createdNorth.getCacheFileContent).not.toHaveBeenCalled();
    await engine.getCacheFileContent(testData.north.list[0].id, 'file');
    expect(createdNorth.getCacheFileContent).toHaveBeenCalledWith('file');

    await engine.removeCacheFiles('bad id', ['file']);
    expect(createdNorth.removeCacheFiles).not.toHaveBeenCalled();
    await engine.removeCacheFiles(testData.north.list[0].id, ['file']);
    expect(createdNorth.removeCacheFiles).toHaveBeenCalledWith(['file']);

    await engine.archiveCacheFiles('bad id', ['file']);
    expect(createdNorth.archiveCacheFiles).not.toHaveBeenCalled();
    await engine.archiveCacheFiles(testData.north.list[0].id, ['file']);
    expect(createdNorth.archiveCacheFiles).toHaveBeenCalledWith(['file']);
  });

  it('should manage archive files', async () => {
    await engine.start();

    await engine.getArchiveFiles('bad id', testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(createdNorth.getArchiveFiles).not.toHaveBeenCalled();
    await engine.getArchiveFiles(testData.north.list[0].id, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(createdNorth.getArchiveFiles).toHaveBeenCalledWith(testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');

    await engine.getArchiveFileContent('bad id', 'file');
    expect(createdNorth.getArchiveFileContent).not.toHaveBeenCalled();
    await engine.getArchiveFileContent(testData.north.list[0].id, 'file');
    expect(createdNorth.getArchiveFileContent).toHaveBeenCalledWith('file');

    await engine.removeArchiveFiles('bad id', ['file']);
    expect(createdNorth.removeArchiveFiles).not.toHaveBeenCalled();
    await engine.removeArchiveFiles(testData.north.list[0].id, ['file']);
    expect(createdNorth.removeArchiveFiles).toHaveBeenCalledWith(['file']);

    await engine.retryArchiveFiles('bad id', ['file']);
    expect(createdNorth.retryArchiveFiles).not.toHaveBeenCalled();
    await engine.retryArchiveFiles(testData.north.list[0].id, ['file']);
    expect(createdNorth.retryArchiveFiles).toHaveBeenCalledWith(['file']);

    await engine.removeAllArchiveFiles('bad id');
    expect(createdNorth.removeAllArchiveFiles).not.toHaveBeenCalled();
    await engine.removeAllArchiveFiles(testData.north.list[0].id);
    expect(createdNorth.removeAllArchiveFiles).toHaveBeenCalledWith();

    await engine.retryAllArchiveFiles('bad id');
    expect(createdNorth.retryAllArchiveFiles).not.toHaveBeenCalled();
    await engine.retryAllArchiveFiles(testData.north.list[0].id);
    expect(createdNorth.retryAllArchiveFiles).toHaveBeenCalledWith();
  });

  it('should manage cache time-values', async () => {
    await engine.start();

    await engine.getCacheValues('bad id', 'file');
    expect(createdNorth.getCacheValues).not.toHaveBeenCalled();
    await engine.getCacheValues(testData.north.list[0].id, 'file');
    expect(createdNorth.getCacheValues).toHaveBeenCalledWith('file');

    await engine.removeCacheValues('bad id', ['file']);
    expect(createdNorth.removeCacheValues).not.toHaveBeenCalled();
    await engine.removeCacheValues(testData.north.list[0].id, ['file']);
    expect(createdNorth.removeCacheValues).toHaveBeenCalledWith(['file']);

    await engine.removeAllCacheValues('bad id');
    expect(createdNorth.removeAllCacheValues).not.toHaveBeenCalled();
    await engine.removeAllCacheValues(testData.north.list[0].id);
    expect(createdNorth.removeAllCacheValues).toHaveBeenCalledWith();
  });

  it('should manage error cache time-values', async () => {
    await engine.start();

    await engine.getValueErrors('bad id', testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(createdNorth.getValueErrors).not.toHaveBeenCalled();
    await engine.getValueErrors(testData.north.list[0].id, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(createdNorth.getValueErrors).toHaveBeenCalledWith(testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');

    await engine.removeValueErrors('bad id', ['file']);
    expect(createdNorth.removeValueErrors).not.toHaveBeenCalled();
    await engine.removeValueErrors(testData.north.list[0].id, ['file']);
    expect(createdNorth.removeValueErrors).toHaveBeenCalledWith(['file']);

    await engine.removeAllValueErrors('bad id');
    expect(createdNorth.removeAllValueErrors).not.toHaveBeenCalled();
    await engine.removeAllValueErrors(testData.north.list[0].id);
    expect(createdNorth.removeAllValueErrors).toHaveBeenCalledWith();

    await engine.retryValueErrors('bad id', ['file']);
    expect(createdNorth.retryValueErrors).not.toHaveBeenCalled();
    await engine.retryValueErrors(testData.north.list[0].id, ['file']);
    expect(createdNorth.retryValueErrors).toHaveBeenCalledWith(['file']);

    await engine.retryAllValueErrors('bad id');
    expect(createdNorth.retryAllValueErrors).not.toHaveBeenCalled();
    await engine.retryAllValueErrors(testData.north.list[0].id);
    expect(createdNorth.retryAllValueErrors).toHaveBeenCalledWith();
  });

  it('should manage data stream and metrics', async () => {
    await engine.start();

    engine.getNorthDataStream('bad id');
    expect(createdNorth.getMetricsDataStream).not.toHaveBeenCalled();
    engine.getNorthDataStream(testData.north.list[0].id);
    expect(createdNorth.getMetricsDataStream).toHaveBeenCalled();

    engine.getSouthDataStream('bad id');
    expect(createdSouth.getMetricsDataStream).not.toHaveBeenCalled();
    engine.getSouthDataStream(testData.south.list[0].id);
    expect(createdSouth.getMetricsDataStream).toHaveBeenCalled();

    engine.resetSouthMetrics('bad id');
    expect(createdSouth.resetMetrics).not.toHaveBeenCalled();
    engine.resetSouthMetrics(testData.south.list[0].id);
    expect(createdSouth.resetMetrics).toHaveBeenCalled();

    engine.resetNorthMetrics('bad id');
    expect(createdNorth.resetMetrics).not.toHaveBeenCalled();
    engine.resetNorthMetrics(testData.north.list[0].id);
    expect(createdNorth.resetMetrics).toHaveBeenCalled();
  });

  it('should manage item change', async () => {
    await engine.start();

    await engine.onSouthItemsChange('bad id');
    expect(createdSouth.onItemChange).not.toHaveBeenCalled();
    await engine.onSouthItemsChange(testData.south.list[0].id);
    expect(createdSouth.onItemChange).toHaveBeenCalled();
  });

  it('should update north subscription', async () => {
    await engine.start();

    engine.updateSubscriptions('bad id');
    expect(createdNorth.updateConnectorSubscription).not.toHaveBeenCalled();
    engine.updateSubscriptions(testData.north.list[0].id);
    expect(createdNorth.updateConnectorSubscription).toHaveBeenCalled();
  });

  it('should update scan mode', async () => {
    await engine.start();

    await engine.updateScanMode(testData.scanMode.list[0]);
    expect(createdSouth.updateScanMode).toHaveBeenCalled();
    expect(createdNorth.updateScanMode).toHaveBeenCalled();
  });

  it('should properly reload', async () => {
    const startSouthSpy = jest.spyOn(engine, 'startSouth');
    const stopSouthSpy = jest.spyOn(engine, 'stopSouth');
    const startNorthSpy = jest.spyOn(engine, 'startNorth');
    const stopNorthSpy = jest.spyOn(engine, 'stopNorth');

    await engine.reloadNorth('northId');
    expect(stopNorthSpy).toHaveBeenCalled();
    expect(startNorthSpy).toHaveBeenCalled();

    await engine.reloadSouth('southId');
    expect(stopSouthSpy).toHaveBeenCalled();
    expect(startSouthSpy).toHaveBeenCalled();
  });
});
