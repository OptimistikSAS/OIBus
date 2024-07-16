import PinoLogger from '../tests/__mocks__/logger.mock';
import SouthServiceMock from '../tests/__mocks__/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/north-service.mock';

import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../shared/model/south-connector.model';
import { NorthConnectorDTO } from '../../../shared/model/north-connector.model';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import OIBusEngine from './oibus-engine';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ScanModeDTO } from '../../../shared/model/scan-mode.model';
import { filesExists } from '../service/utils';
import HomeMetricsServiceMock from '../tests/__mocks__/home-metrics-service.mock';
import HomeMetricsService from '../service/home-metrics.service';
import { OIBusTimeValue } from '../../../shared/model/engine.model';

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
const homeMetrics: HomeMetricsService = new HomeMetricsServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

const nowDateString = '2020-02-02T02:02:02.222Z';

let engine: OIBusEngine;

const southItems: Array<SouthConnectorItemDTO> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    enabled: true,
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId2'
  },
  {
    id: 'id3',
    name: 'item3',
    enabled: true,
    connectorId: 'southId',
    settings: {},
    scanModeId: 'subscription'
  }
];

const connectedEvent = new EventEmitter();

const northConnectors: Array<NorthConnectorDTO> = [
  {
    id: 'id1',
    name: 'myNorthConnector1',
    description: 'a test north connector',
    enabled: true,
    type: 'oianalytics'
  } as NorthConnectorDTO,
  {
    id: 'id2',
    name: 'myNorthConnector2',
    description: 'a test north connector',
    enabled: false,
    type: 'oiconnect'
  } as NorthConnectorDTO
];
const northConnectorWithItems: NorthConnectorDTO = {
  id: 'northIdWithItems',
  name: 'myNorthConnectorWithItems3',
  description: 'a test north connector with items',
  enabled: true,
  type: 'modbus'
} as NorthConnectorDTO;
const southConnectors: Array<SouthConnectorDTO> = [
  {
    id: 'id1',
    type: 'sqlite',
    name: 'South Connector1',
    description: 'My first South connector description',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {}
  },
  {
    id: 'id2',
    type: 'opcua-ha',
    name: 'South Connector 2',
    description: 'My second South connector description',
    enabled: false,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {}
  }
];
const createdSouth = {
  start: jest.fn(),
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
  start: jest.fn(),
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
  onItemChange: jest.fn(),
  settings: { id: 'id1', name: 'myNorthConnector1', type: 'oianalytics' }
};

const createdNorthWithItems = {
  ...createdNorth
};

describe('OIBusEngine', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (southService.createSouth as jest.Mock).mockReturnValue(createdSouth);
    (northService.createNorth as jest.Mock).mockReturnValue(createdNorth);

    engine = new OIBusEngine(encryptionService, northService, southService, homeMetrics, logger);
  });

  it('it should start', async () => {
    (northService.getNorthList as jest.Mock).mockReturnValue(northConnectors);
    (southService.getSouthList as jest.Mock).mockReturnValue(southConnectors);

    engine.createNorth = jest
      .fn()
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => {
        throw new Error('error');
      });
    engine.createSouth = jest
      .fn()
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => {
        throw new Error('error');
      });
    await engine.start();
    expect(logger.info).toHaveBeenCalledWith(`OIBus engine started`);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating North connector "${northConnectors[1].name}" of type "${northConnectors[1].type}" (${
        northConnectors[1].id
      }): ${new Error('error')}`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating South connector "${southConnectors[1].name}" of type "${southConnectors[1].type}" (${
        southConnectors[1].id
      }): ${new Error('error')}`
    );
  });

  it('it should start connectors and stop all', async () => {
    createdSouth.start.mockImplementation(() => {
      return new Promise((_resolve, reject) => {
        reject('error');
      });
    });

    createdNorth.start.mockImplementation(() => {
      return new Promise((_resolve, reject) => {
        reject('error');
      });
    });
    (southService.getSouthItems as jest.Mock).mockReturnValue(southItems);
    createdNorth.isSubscribed.mockReturnValue(true);

    await engine.createSouth(southConnectors[0]);
    expect(southService.createSouth).toHaveBeenCalledTimes(1);

    await engine.startSouth(southConnectors[0].id);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting South connector "${southConnectors[0].name}" of type "${southConnectors[0].type}" (${southConnectors[0].id}): error`
    );

    createdSouth.connectedEvent.emit('connected');
    expect(createdSouth.onItemChange).toHaveBeenCalledTimes(1);

    await engine.createNorth(northConnectors[0]);
    expect(northService.createNorth).toHaveBeenCalledTimes(1);
    await engine.startNorth(northConnectors[0].id);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting North connector "${northConnectors[0].name}" of type "${northConnectors[0].type}" (${northConnectors[0].id}): error`
    );
    expect(createdNorth.onItemChange).toHaveBeenCalledTimes(1);

    await engine.startSouth(southConnectors[1].id);
    expect(logger.trace).toHaveBeenCalledWith(`South connector ${southConnectors[1].id} not set`);
    await engine.startNorth(northConnectors[1].id);
    expect(logger.trace).toHaveBeenCalledWith(`North connector ${northConnectors[1].id} not set`);

    createdNorth.isEnabled.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await engine.addContent('southId', { type: 'time-values', content: [{}, {}] as Array<OIBusTimeValue> });
    await engine.addContent('southId', { type: 'time-values', content: [{}, {}] as Array<OIBusTimeValue> });
    expect(createdNorth.cacheValues).toHaveBeenCalledTimes(1);
    expect(createdNorth.cacheValues).toHaveBeenCalledWith([{}, {}]);

    createdNorth.isEnabled.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await engine.addExternalContent('id1', { type: 'time-values', content: [{}, {}] as Array<OIBusTimeValue> });
    await engine.addExternalContent('id1', { type: 'time-values', content: [{}, {}] as Array<OIBusTimeValue> });
    expect(createdNorth.cacheValues).toHaveBeenCalledTimes(2);
    expect(createdNorth.cacheValues).toHaveBeenCalledWith([{}, {}]);

    createdNorth.isEnabled.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await engine.addContent('southId', { type: 'raw', filePath: 'filePath' });
    await engine.addContent('southId', { type: 'raw', filePath: 'filePath' });
    expect(createdNorth.cacheFile).toHaveBeenCalledTimes(1);
    expect(createdNorth.cacheFile).toHaveBeenCalledWith('filePath');

    createdNorth.isEnabled.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await engine.addExternalContent('id1', { type: 'raw', filePath: 'filePath' });
    await engine.addExternalContent('id1', { type: 'raw', filePath: 'filePath' });
    expect(createdNorth.cacheFile).toHaveBeenCalledTimes(2);
    expect(createdNorth.cacheFile).toHaveBeenCalledWith('filePath');

    await engine.getErrorFiles('northId', '2020-02-02T02:02:02.222Z', '2022-02-02T02:02:02.222Z', '');
    expect(createdNorth.getErrorFiles).not.toHaveBeenCalled();
    await engine.getErrorFiles(northConnectors[0].id, '2020-02-02T02:02:02.222Z', '2022-02-02T02:02:02.222Z', '');
    expect(createdNorth.getErrorFiles).toHaveBeenCalledWith('2020-02-02T02:02:02.222Z', '2022-02-02T02:02:02.222Z', '');

    await engine.getErrorFileContent('northId', 'file1');
    expect(createdNorth.getErrorFileContent).not.toHaveBeenCalled();
    await engine.getErrorFileContent(northConnectors[0].id, 'file1');
    expect(createdNorth.getErrorFileContent).toHaveBeenCalledWith('file1');

    await engine.retryErrorFiles('northId', ['file1']);
    expect(createdNorth.retryErrorFiles).not.toHaveBeenCalled();
    await engine.retryErrorFiles(northConnectors[0].id, ['file1']);
    expect(createdNorth.retryErrorFiles).toHaveBeenCalledWith(['file1']);

    await engine.removeErrorFiles('northId', ['file1']);
    expect(createdNorth.removeErrorFiles).not.toHaveBeenCalled();
    await engine.removeErrorFiles(northConnectors[0].id, ['file1']);
    expect(createdNorth.removeErrorFiles).toHaveBeenCalledWith(['file1']);

    await engine.removeAllErrorFiles('northId');
    expect(createdNorth.removeAllErrorFiles).not.toHaveBeenCalled();
    await engine.removeAllErrorFiles(northConnectors[0].id);
    expect(createdNorth.removeAllErrorFiles).toHaveBeenCalled();

    await engine.retryAllErrorFiles('northId');
    expect(createdNorth.retryAllErrorFiles).not.toHaveBeenCalled();
    await engine.retryAllErrorFiles(northConnectors[0].id);
    expect(createdNorth.retryAllErrorFiles).toHaveBeenCalled();

    await engine.getCacheFiles('northId', '2020-02-02T02:02:02.222Z', '2022-02-02T02:02:02.222Z', '');
    expect(createdNorth.getCacheFiles).not.toHaveBeenCalled();
    await engine.getCacheFiles(northConnectors[0].id, '2020-02-02T02:02:02.222Z', '2022-02-02T02:02:02.222Z', '');
    expect(createdNorth.getCacheFiles).toHaveBeenCalledWith('2020-02-02T02:02:02.222Z', '2022-02-02T02:02:02.222Z', '');

    await engine.getCacheFileContent('northId', 'file1');
    expect(createdNorth.getCacheFileContent).not.toHaveBeenCalled();
    await engine.getCacheFileContent(northConnectors[0].id, 'file1');
    expect(createdNorth.getCacheFileContent).toHaveBeenCalledWith('file1');

    await engine.removeCacheFiles('northId', ['file1']);
    expect(createdNorth.removeCacheFiles).not.toHaveBeenCalled();
    await engine.removeCacheFiles(northConnectors[0].id, ['file1']);
    expect(createdNorth.removeCacheFiles).toHaveBeenCalledWith(['file1']);

    await engine.archiveCacheFiles('northId', ['file1']);
    expect(createdNorth.archiveCacheFiles).not.toHaveBeenCalled();
    await engine.archiveCacheFiles(northConnectors[0].id, ['file1']);
    expect(createdNorth.archiveCacheFiles).toHaveBeenCalledWith(['file1']);

    await engine.getArchiveFiles('northId', '2020-02-02T02:02:02.222Z', '2022-02-02T02:02:02.222Z', '');
    expect(createdNorth.getArchiveFiles).not.toHaveBeenCalled();
    await engine.getArchiveFiles(northConnectors[0].id, '2020-02-02T02:02:02.222Z', '2022-02-02T02:02:02.222Z', '');
    expect(createdNorth.getArchiveFiles).toHaveBeenCalledWith('2020-02-02T02:02:02.222Z', '2022-02-02T02:02:02.222Z', '');

    await engine.getArchiveFileContent('northId', 'file1');
    expect(createdNorth.getArchiveFileContent).not.toHaveBeenCalled();
    await engine.getArchiveFileContent(northConnectors[0].id, 'file1');
    expect(createdNorth.getArchiveFileContent).toHaveBeenCalledWith('file1');

    await engine.retryArchiveFiles('northId', ['file1']);
    expect(createdNorth.retryArchiveFiles).not.toHaveBeenCalled();
    await engine.retryArchiveFiles(northConnectors[0].id, ['file1']);
    expect(createdNorth.retryArchiveFiles).toHaveBeenCalledWith(['file1']);

    await engine.removeArchiveFiles('northId', ['file1']);
    expect(createdNorth.removeArchiveFiles).not.toHaveBeenCalled();
    await engine.removeArchiveFiles(northConnectors[0].id, ['file1']);
    expect(createdNorth.removeArchiveFiles).toHaveBeenCalledWith(['file1']);

    await engine.removeAllArchiveFiles('northId');
    expect(createdNorth.removeAllArchiveFiles).not.toHaveBeenCalled();
    await engine.removeAllArchiveFiles(northConnectors[0].id);
    expect(createdNorth.removeAllArchiveFiles).toHaveBeenCalled();

    await engine.retryAllArchiveFiles('northId');
    expect(createdNorth.retryAllArchiveFiles).not.toHaveBeenCalled();
    await engine.retryAllArchiveFiles(northConnectors[0].id);
    expect(createdNorth.retryAllArchiveFiles).toHaveBeenCalled();

    createdNorth.getMetricsDataStream.mockReturnValue({ status: 'myStatus' });
    expect(engine.getNorthDataStream('northId')).toEqual(null);
    expect(engine.getNorthDataStream(northConnectors[0].id)).toEqual({ status: 'myStatus' });

    createdNorth.resetMetrics.mockReturnValue({ status: 'myStatus' });
    expect(engine.resetNorthMetrics('northId')).toEqual(null);
    expect(engine.resetNorthMetrics(northConnectors[0].id)).toEqual({ status: 'myStatus' });

    createdSouth.getMetricsDataStream.mockReturnValue({ status: 'myStatus' });
    expect(engine.getSouthDataStream('southId')).toEqual(null);
    expect(engine.getSouthDataStream(southConnectors[0].id)).toEqual({ status: 'myStatus' });

    createdSouth.resetMetrics.mockReturnValue({ status: 'myStatus' });
    expect(engine.resetSouthMetrics('southId')).toEqual(null);
    expect(engine.resetSouthMetrics(southConnectors[0].id)).toEqual({ status: 'myStatus' });

    (southService.getSouth as jest.Mock).mockReturnValueOnce(southConnectors[0]).mockReturnValueOnce(southConnectors[1]);
    (northService.getNorth as jest.Mock).mockReturnValueOnce(northConnectors[0]).mockReturnValueOnce(northConnectors[1]);

    engine.setLogger(anotherLogger);
    expect(createdNorth.setLogger).toHaveBeenCalledTimes(1);
    expect(createdSouth.setLogger).toHaveBeenCalledTimes(1);
    expect(anotherLogger.child).toHaveBeenCalledWith({
      scopeType: 'south',
      scopeId: southConnectors[0].id,
      scopeName: southConnectors[0].name
    });

    expect(anotherLogger.child).toHaveBeenCalledWith({
      scopeType: 'north',
      scopeId: northConnectors[0].id,
      scopeName: northConnectors[0].name
    });

    (southService.getSouth as jest.Mock).mockReturnValueOnce(southConnectors[0]).mockReturnValueOnce(southConnectors[1]);
    (northService.getNorth as jest.Mock).mockReturnValueOnce(northConnectors[0]).mockReturnValueOnce(northConnectors[1]);
    await engine.updateScanMode({ id: 'scanModeId' } as ScanModeDTO);
    expect(createdNorth.updateScanMode).toHaveBeenCalledTimes(1);
    expect(createdSouth.updateScanMode).toHaveBeenCalledTimes(1);

    (southService.getSouth as jest.Mock).mockReturnValueOnce(null).mockReturnValueOnce(null);
    (northService.getNorth as jest.Mock).mockReturnValueOnce(null).mockReturnValueOnce(null);
    await engine.updateScanMode({ id: 'scanModeId' } as ScanModeDTO);
    expect(createdNorth.updateScanMode).toHaveBeenCalledTimes(2);
    expect(createdSouth.updateScanMode).toHaveBeenCalledTimes(2);

    await engine.onSouthItemsChange(southConnectors[0].id);
    await engine.onSouthItemsChange('southId');
    expect(createdSouth.onItemChange).toHaveBeenCalledTimes(2);

    await engine.onNorthItemsChange(northConnectors[0].id);
    await engine.onNorthItemsChange('northId');
    expect(createdNorth.onItemChange).toHaveBeenCalledTimes(2);

    // Cache value operations
    // Get cache values
    await engine.getCacheValues('id1', '');
    expect(createdNorth.getCacheValues).toHaveBeenCalledWith('');

    await engine.getCacheValues('id1', 'file');
    expect(createdNorth.getCacheValues).toHaveBeenCalledWith('file');

    await engine.getCacheValues('northId', '');
    expect(createdNorth.getCacheValues).toHaveBeenCalledTimes(2);

    // Remove cache values
    await engine.removeCacheValues('id1', ['1.queue.tmp', '2.queue.tmp']);
    expect(createdNorth.removeCacheValues).toHaveBeenCalledWith(['1.queue.tmp', '2.queue.tmp']);

    await engine.removeCacheValues('northId', []);
    expect(createdNorth.removeCacheValues).toHaveBeenCalledTimes(1);

    // Remove all cache values
    await engine.removeAllCacheValues('id1');
    expect(createdNorth.removeAllCacheValues).toHaveBeenCalled();

    await engine.removeAllCacheValues('northId');
    expect(createdNorth.removeAllCacheValues).toHaveBeenCalledTimes(1);

    // Get cache value errors
    await engine.getValueErrors('id1', '', '', '');
    expect(createdNorth.getValueErrors).toHaveBeenCalledWith('', '', '');

    await engine.getValueErrors('northId', '', '', '');
    expect(createdNorth.getValueErrors).toHaveBeenCalledTimes(1);

    // Remove cache value errors
    await engine.removeValueErrors('id1', ['1.queue.tmp', '2.queue.tmp']);
    expect(createdNorth.removeValueErrors).toHaveBeenCalledWith(['1.queue.tmp', '2.queue.tmp']);

    await engine.removeValueErrors('northId', []);
    expect(createdNorth.removeValueErrors).toHaveBeenCalledTimes(1);

    // Remove all cache value errors
    await engine.removeAllValueErrors('id1');
    expect(createdNorth.removeAllValueErrors).toHaveBeenCalled();

    await engine.removeAllValueErrors('northId');
    expect(createdNorth.removeAllValueErrors).toHaveBeenCalledTimes(1);

    // Retry cache value errors
    await engine.retryValueErrors('id1', ['1.queue.tmp', '2.queue.tmp']);
    expect(createdNorth.retryValueErrors).toHaveBeenCalledWith(['1.queue.tmp', '2.queue.tmp']);

    await engine.retryValueErrors('northId', []);
    expect(createdNorth.retryValueErrors).toHaveBeenCalledTimes(1);

    // Retry all cache value errors
    await engine.retryAllValueErrors('id1');
    expect(createdNorth.retryAllValueErrors).toHaveBeenCalled();

    await engine.retryAllValueErrors('northId');
    expect(createdNorth.retryAllValueErrors).toHaveBeenCalledTimes(1);

    engine.updateNorthConnectorSubscriptions(northConnectors[0].id);
    engine.updateNorthConnectorSubscriptions('northId');
    expect(createdNorth.updateConnectorSubscription).toHaveBeenCalledTimes(1);

    await engine.stopSouth('southId');
    expect(createdSouth.stop).not.toHaveBeenCalled();
    await engine.stopNorth('northId');
    expect(createdNorth.stop).not.toHaveBeenCalled();

    // North with items
    (northService.createNorth as jest.Mock).mockReturnValueOnce(createdNorthWithItems);
    await engine.startNorth(northConnectorWithItems.id);
    expect(northService.createNorth).toHaveBeenCalled();
    expect(createdNorth.isEnabled).toHaveBeenCalled();

    await engine.stop();
    expect(createdSouth.stop).toHaveBeenCalledTimes(1);
    expect(createdNorth.stop).toHaveBeenCalledTimes(1);

    createdNorth.stop = jest.fn().mockImplementation(() => {
      return new Promise(resolve => {
        resolve('');
      });
    });
    createdNorth.start = jest.fn().mockImplementation(() => {
      return new Promise(resolve => {
        resolve('');
      });
    });
    await engine.reloadNorth(northConnectors[0].id);
    expect(createdNorth.stop).toHaveBeenCalledTimes(1);
    expect(createdNorth.start).toHaveBeenCalledTimes(1);

    createdSouth.start = jest.fn().mockImplementation(() => {
      return new Promise(resolve => {
        resolve('');
      });
    });
    createdSouth.stop = jest.fn().mockImplementation(() => {
      return new Promise(resolve => {
        resolve('');
      });
    });
    await engine.reloadSouth(southConnectors[0].id);
    expect(createdSouth.stop).toHaveBeenCalledTimes(1);
    expect(createdSouth.start).toHaveBeenCalledTimes(1);
  });

  it('should delete south connector', async () => {
    (filesExists as jest.Mock).mockImplementationOnce(() => Promise.resolve(true)).mockImplementationOnce(() => Promise.resolve(false));
    const stopSouthSpy = jest.spyOn(engine, 'stopSouth');

    (northService.getNorthList as jest.Mock).mockReturnValue([]);
    (southService.getSouthList as jest.Mock).mockReturnValue(southConnectors);
    (southService.createSouth as jest.Mock).mockReturnValue(createdSouth);
    await engine.start();

    const southId = southConnectors[0].id;
    const name = southConnectors[0].name;
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

    (southService.getSouthList as jest.Mock).mockReturnValue([]);
    (northService.getNorthList as jest.Mock).mockReturnValue(northConnectors);
    (northService.createNorth as jest.Mock).mockReturnValue(createdNorth);
    await engine.start();

    const northId = northConnectors[0].id;
    const name = northConnectors[0].name;
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

    (southService.getSouthList as jest.Mock).mockReturnValue(southConnectors);
    (southService.createSouth as jest.Mock).mockReturnValue(createdSouth);
    (northService.getNorthList as jest.Mock).mockReturnValue(northConnectors);
    (northService.createNorth as jest.Mock).mockReturnValue(createdNorth);
    await engine.start();

    const error = new Error(`Can't remove folder`);
    (fs.rm as jest.Mock).mockImplementation(() => {
      throw error;
    });

    // South Connector error
    const southId = southConnectors[0].id;
    const southName = southConnectors[0].name;
    const southBaseFolder = path.resolve('./cache/data-stream', `south-${southId}`);
    await engine.deleteSouth(southId, southName);

    expect(stopSouthSpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Deleting base folder "${southBaseFolder}" of South connector "${southName}" (${southId})`);
    expect(logger.error).toHaveBeenCalledWith(`Unable to delete South connector "${southName}" (${southId} base folder: ${error}`);

    // North Connector error
    const northId = northConnectors[0].id;
    const northName = northConnectors[0].name;
    const northBaseFolder = path.resolve('./cache/data-stream', `north-${northId}`);
    await engine.deleteNorth(northId, northName);

    expect(stopNorthSpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Deleting base folder "${northBaseFolder}" of North connector "${northName}" (${northId})`);
    expect(logger.error).toHaveBeenCalledWith(`Unable to delete North connector "${northName}" (${northId}) base folder: ${error}`);
  });
});
