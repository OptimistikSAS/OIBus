import pino from 'pino';
import { buildHistoryQuery, createHistoryQueryOrchestrator, deleteHistoryQueryCache, initHistoryQueryCache } from './history-query-factory';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from 'src/repository/config/oianalytics-registration.repository';
import CacheService from '../service/cache/cache.service';
import { buildNorth } from '../north/north-connector-factory';
import { buildSouth } from '../south/south-connector-factory';
import { HistoryQueryEntity } from '../model/histor-query.model';
import { createFolder } from '../service/utils';
import fs from 'node:fs/promises';
import path from 'node:path';
import HistoryQuery from './history-query';
import { NorthFileWriterSettings, NorthSettings } from '../../shared/model/north-settings.model';
import { SouthItemSettings, SouthModbusSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { CONTENT_FOLDER, METADATA_FOLDER } from '../model/engine.model';
import testData from '../tests/utils/test-data';

// Mock dependencies
jest.mock('node:fs/promises');
jest.mock('../service/utils');
jest.mock('../service/cache/cache.service');
jest.mock('../north/north-connector-factory');
jest.mock('../south/south-connector-factory');
jest.mock('./history-query');

describe('HistoryQueryFactory', () => {
  const mockLogger = {} as pino.Logger;
  const mockSouthCacheRepository = {} as SouthCacheRepository;
  const mockCertificateRepository = {} as CertificateRepository;
  const mockOIAnalyticsRegistrationRepository = {} as OIAnalyticsRegistrationRepository;
  const mockOrchestrator = {} as CacheService;
  const mockAddContent = jest.fn();

  const baseFolder = '/tmp/oibus';

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildHistoryQuery', () => {
    const mockSettings: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = {
      id: 'hq-1',
      name: 'History Query 1',
      description: 'Test HQ',
      status: 'RUNNING',
      startTime: testData.constants.dates.DATE_1,
      endTime: testData.constants.dates.DATE_2,
      southType: 'modbus',
      southSettings: { someSouthSetting: true } as unknown as SouthModbusSettings,
      northType: 'file-writer',
      northSettings: { someNorthSetting: true } as unknown as NorthFileWriterSettings,
      caching: {
        trigger: {
          scanMode: { id: 'manual', name: 'Manual', description: '', cron: '' },
          numberOfElements: 100,
          numberOfFiles: 10
        },
        throttling: {
          runMinDelay: 1000,
          maxSize: 1000,
          maxNumberOfElements: 1000
        },
        error: {
          retryInterval: 5000,
          retryCount: 3,
          retentionDuration: 86400
        },
        archive: {
          enabled: true,
          retentionDuration: 604800
        }
      },
      items: [],
      northTransformers: [
        {
          id: 't1',
          transformer: {} as any,
          options: {},
          inputType: 'time-values',
          items: []
        }
      ]
    } as HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>;

    const mockNorthConnector = { cacheContent: jest.fn() };
    const mockSouthConnector = {};

    beforeEach(() => {
      (buildNorth as jest.Mock).mockReturnValue(mockNorthConnector);
      (buildSouth as jest.Mock).mockReturnValue(mockSouthConnector);
    });

    it('should build north and south connectors and return HistoryQuery instance', () => {
      const result = buildHistoryQuery(
        mockSettings,
        mockAddContent,
        mockLogger,
        baseFolder,
        mockSouthCacheRepository,
        mockCertificateRepository,
        mockOIAnalyticsRegistrationRepository,
        mockOrchestrator
      );

      // Verify Build North
      expect(buildNorth).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockSettings.id,
          name: mockSettings.name,
          enabled: true,
          type: mockSettings.northType,
          settings: mockSettings.northSettings,
          caching: mockSettings.caching,
          transformers: expect.arrayContaining([expect.objectContaining({ id: 't1', inputType: 'time-values' })])
        }),
        mockLogger,
        mockCertificateRepository,
        mockOIAnalyticsRegistrationRepository,
        mockOrchestrator
      );

      // Verify Build South
      expect(buildSouth).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockSettings.id,
          name: mockSettings.name,
          enabled: true,
          type: mockSettings.southType,
          settings: mockSettings.southSettings,
          items: []
        }),
        expect.any(Function), // The addContent callback
        mockLogger,
        path.join(baseFolder, 'cache', `history-${mockSettings.id}`, 'south'),
        mockSouthCacheRepository,
        mockCertificateRepository,
        mockOIAnalyticsRegistrationRepository
      );

      expect(HistoryQuery).toHaveBeenCalledWith(mockSettings, mockNorthConnector, mockSouthConnector, mockLogger);
      expect(result).toBeInstanceOf(HistoryQuery);
    });

    it('should handle north caching callback inside south connector', async () => {
      buildHistoryQuery(
        mockSettings,
        mockAddContent,
        mockLogger,
        baseFolder,
        mockSouthCacheRepository,
        mockCertificateRepository,
        mockOIAnalyticsRegistrationRepository,
        mockOrchestrator
      );

      // Extract the callback passed to buildSouth
      const southCallback = (buildSouth as jest.Mock).mock.calls[0][1];

      const mockData = { type: 'data' };
      const mockQueryTime = '2023-01-01';
      const mockItemIds = ['item1'];

      await southCallback('southId', mockData, mockQueryTime, mockItemIds);

      expect(mockNorthConnector.cacheContent).toHaveBeenCalledWith(mockData, {
        source: 'south',
        southId: mockSettings.id,
        queryTime: mockQueryTime,
        itemIds: mockItemIds
      });
    });
  });

  describe('initHistoryQueryCache', () => {
    const id = 'hq-1';

    it('should create all necessary folders for standard types', async () => {
      await initHistoryQueryCache(id, 'file-writer', 'modbus', baseFolder);

      const historyPath = `history-${id}`;

      // North Cache Folders
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', historyPath, 'north'));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', historyPath, 'north', METADATA_FOLDER));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', historyPath, 'north', CONTENT_FOLDER));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', historyPath, 'north', 'tmp'));

      // North Error Folders
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'error', historyPath, 'north'));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'error', historyPath, 'north', METADATA_FOLDER));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'error', historyPath, 'north', CONTENT_FOLDER));

      // North Archive Folders
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'archive', historyPath, 'north'));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'archive', historyPath, 'north', METADATA_FOLDER));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'archive', historyPath, 'north', CONTENT_FOLDER));

      // South Cache Folders
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', historyPath, 'south'));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', historyPath, 'south', 'tmp'));

      // Ensure OPCUA folders are NOT created
      expect(createFolder).not.toHaveBeenCalledWith(path.join(baseFolder, 'cache', historyPath, 'north', 'opcua'));
      expect(createFolder).not.toHaveBeenCalledWith(path.join(baseFolder, 'cache', historyPath, 'south', 'opcua'));
    });

    it('should create opcua specific folders if types are opcua', async () => {
      await initHistoryQueryCache(id, 'opcua', 'opcua', baseFolder);

      const historyPath = `history-${id}`;
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', historyPath, 'north', 'opcua'));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', historyPath, 'south', 'opcua'));
    });
  });

  describe('createHistoryQueryOrchestrator', () => {
    it('should instantiate CacheService with correct paths', () => {
      const id = 'hq-1';
      createHistoryQueryOrchestrator(baseFolder, id, mockLogger);

      const historyPath = `history-${id}`;
      expect(CacheService).toHaveBeenCalledWith(
        mockLogger,
        path.join(baseFolder, 'cache', historyPath, 'north'),
        path.join(baseFolder, 'error', historyPath, 'north'),
        path.join(baseFolder, 'archive', historyPath, 'north')
      );
    });
  });

  describe('deleteHistoryQueryCache', () => {
    it('should remove all history cache folders', async () => {
      const id = 'hq-1';
      await deleteHistoryQueryCache(id, baseFolder);

      const historyPath = `history-${id}`;
      expect(fs.rm).toHaveBeenCalledTimes(3);
      expect(fs.rm).toHaveBeenCalledWith(path.join(baseFolder, 'cache', historyPath), { recursive: true, force: true });
      expect(fs.rm).toHaveBeenCalledWith(path.join(baseFolder, 'error', historyPath), { recursive: true, force: true });
      expect(fs.rm).toHaveBeenCalledWith(path.join(baseFolder, 'archive', historyPath), { recursive: true, force: true });
    });
  });
});
