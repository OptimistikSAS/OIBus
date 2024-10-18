import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import LogRepository from './log.repository';
import testData from '../../tests/utils/test-data';
import EngineMetricsRepository from './engine-metrics.repository';
import NorthConnectorMetricsRepository from './north-connector-metrics.repository';
import SouthConnectorMetricsRepository from './south-connector-metrics.repository';
import { createPageFromArray } from '../../../../shared/model/types';
import { EngineMetrics, HistoryQueryMetrics, NorthConnectorMetrics, SouthConnectorMetrics } from '../../../../shared/model/engine.model';
import HistoryQueryMetricsRepository from './history-query-metrics.repository';

let database: Database;
describe('Repository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase('logs');
  });

  afterAll(async () => {
    await emptyDatabase('logs');
  });

  describe('Logs', () => {
    let repository: LogRepository;

    beforeEach(() => {
      jest.clearAllMocks();

      repository = new LogRepository(database);
    });

    it('should save all logs and search them', () => {
      repository.saveAll(
        testData.logs.list.map(log => {
          let pinoLevel: string;
          switch (log.level) {
            case 'trace':
              pinoLevel = '10';
              break;
            case 'debug':
              pinoLevel = '20';
              break;
            case 'info':
              pinoLevel = '30';
              break;
            case 'warn':
              pinoLevel = '40';
              break;
            case 'error':
              pinoLevel = '50';
              break;
            case 'fatal':
              pinoLevel = '60';
              break;
            default:
              pinoLevel = '20';
              break;
          }

          return {
            msg: log.message,
            scopeType: log.scopeType,
            scopeId: log.scopeId,
            scopeName: log.scopeName,
            time: log.timestamp,
            level: pinoLevel
          };
        })
      );
      repository.saveAll([]);

      expect(
        repository.search({
          levels: [testData.logs.list[0].level],
          scopeIds: [testData.logs.list[0].scopeId as string],
          scopeTypes: [testData.logs.list[0].scopeType],
          messageContent: 'message',
          page: 0,
          start: testData.constants.dates.DATE_1,
          end: testData.constants.dates.DATE_2
        })
      ).toEqual(createPageFromArray([testData.logs.list[0]], 50, 0));

      expect(repository.count()).toEqual(testData.logs.list.length);

      expect(
        repository.search({
          levels: [],
          scopeIds: [],
          scopeTypes: ['internal'],
          messageContent: '',
          page: 0,
          start: testData.constants.dates.DATE_1,
          end: testData.constants.dates.DATE_2
        }).totalElements
      ).toEqual(1);
    });

    it('should delete logs', () => {
      repository.delete(1);
      expect(repository.count()).toEqual(testData.logs.list.length - 1);

      repository.deleteLogsByScopeId('south', testData.logs.list[0].scopeId as string);
      expect(repository.count()).toEqual(testData.logs.list.length - 2);
    });

    it('should search scopes and find by id', () => {
      const result = repository.searchScopesByName(testData.logs.list[2].scopeName as string);
      expect(result).toEqual([{ scopeId: testData.logs.list[2].scopeId, scopeName: testData.logs.list[2].scopeName }]);

      const scope = repository.getScopeById(testData.logs.list[2].scopeId as string);
      expect(scope).toEqual({ scopeId: testData.logs.list[2].scopeId, scopeName: testData.logs.list[2].scopeName });

      expect(repository.getScopeById('bad id')).toEqual(null);
    });
  });

  describe('Engine Metrics', () => {
    let repository: EngineMetricsRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

      repository = new EngineMetricsRepository(database);
    });

    it('should get metrics', () => {
      repository.initMetrics(testData.engine.settings.id);
      const result = repository.getMetrics(testData.engine.settings.id);
      expect(result).toEqual(testData.engine.metrics);
    });

    it('should update metrics', () => {
      const newMetrics: EngineMetrics = JSON.parse(JSON.stringify(testData.engine.metrics));
      newMetrics.metricsStart = testData.constants.dates.DATE_1;
      newMetrics.freeMemory = 3_000_000;
      newMetrics.maxHeapUsed = 10;
      repository.updateMetrics(testData.engine.settings.id, newMetrics);

      const result = repository.getMetrics(testData.engine.settings.id)!;
      expect(result.metricsStart).toEqual(newMetrics.metricsStart);
      expect(result.freeMemory).toEqual(newMetrics.freeMemory);
      expect(result.maxHeapUsed).toEqual(newMetrics.maxHeapUsed);
    });

    it('should remove metrics', () => {
      repository.removeMetrics(testData.engine.settings.id);
      expect(repository.getMetrics(testData.engine.settings.id)).toEqual(null);
    });
  });

  describe('North Connector Metrics', () => {
    let repository: NorthConnectorMetricsRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

      repository = new NorthConnectorMetricsRepository(database);
    });

    it('should get metrics', () => {
      repository.initMetrics(testData.north.list[0].id);
      const result = repository.getMetrics(testData.north.list[0].id);
      expect(result).toEqual(testData.north.metrics);
    });

    it('should update metrics', () => {
      const newMetrics: NorthConnectorMetrics = JSON.parse(JSON.stringify(testData.north.metrics));
      newMetrics.metricsStart = testData.constants.dates.DATE_1;
      newMetrics.numberOfFilesSent = 45;
      newMetrics.lastValueSent = {
        pointId: 'my reference',
        timestamp: testData.constants.dates.DATE_3,
        data: {
          value: 'my value'
        }
      };
      repository.updateMetrics(testData.north.list[0].id, newMetrics);

      const result = repository.getMetrics(testData.north.list[0].id)!;
      expect(result.metricsStart).toEqual(newMetrics.metricsStart);
      expect(result.numberOfFilesSent).toEqual(newMetrics.numberOfFilesSent);
      expect(result.lastValueSent).toEqual(newMetrics.lastValueSent);

      newMetrics.lastValueSent = null;
      repository.updateMetrics(testData.north.list[0].id, newMetrics);
      const resultWithoutValue = repository.getMetrics(testData.north.list[0].id)!;
      expect(resultWithoutValue.lastValueSent).toEqual(null);
    });

    it('should remove metrics', () => {
      repository.removeMetrics(testData.north.list[0].id);
      expect(repository.getMetrics(testData.north.list[0].id)).toEqual(null);
    });
  });

  describe('South Connector Metrics', () => {
    let repository: SouthConnectorMetricsRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

      repository = new SouthConnectorMetricsRepository(database);
    });

    it('should get metrics', () => {
      repository.initMetrics(testData.south.list[0].id);
      const result = repository.getMetrics(testData.south.list[0].id);
      expect(result).toEqual(testData.south.metrics);
    });

    it('should update metrics', () => {
      const newMetrics: SouthConnectorMetrics = JSON.parse(JSON.stringify(testData.south.metrics));
      newMetrics.metricsStart = testData.constants.dates.DATE_1;
      newMetrics.numberOfFilesRetrieved = 45;
      newMetrics.lastValueRetrieved = {
        pointId: 'my reference',
        timestamp: testData.constants.dates.DATE_3,
        data: {
          value: 'my value'
        }
      };
      repository.updateMetrics(testData.south.list[0].id, newMetrics);

      const result = repository.getMetrics(testData.south.list[0].id)!;
      expect(result.metricsStart).toEqual(newMetrics.metricsStart);
      expect(result.numberOfFilesRetrieved).toEqual(newMetrics.numberOfFilesRetrieved);
      expect(result.lastValueRetrieved).toEqual(newMetrics.lastValueRetrieved);

      newMetrics.lastValueRetrieved = null;
      repository.updateMetrics(testData.south.list[0].id, newMetrics);
      const resultWithoutValue = repository.getMetrics(testData.south.list[0].id)!;
      expect(resultWithoutValue.lastValueRetrieved).toEqual(null);
    });

    it('should remove metrics', () => {
      repository.removeMetrics(testData.south.list[0].id);
      expect(repository.getMetrics(testData.south.list[0].id)).toEqual(null);
    });
  });

  describe('History Query Metrics', () => {
    let repository: HistoryQueryMetricsRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

      repository = new HistoryQueryMetricsRepository(database);
    });

    it('should get metrics', () => {
      repository.initMetrics(testData.historyQueries.list[0].id);
      const result = repository.getMetrics(testData.historyQueries.list[0].id);
      expect(result).toEqual(testData.historyQueries.metrics);
    });

    it('should update metrics', () => {
      const newMetrics: HistoryQueryMetrics = JSON.parse(JSON.stringify(testData.historyQueries.metrics));
      newMetrics.metricsStart = testData.constants.dates.DATE_1;
      newMetrics.south.numberOfFilesRetrieved = 45;
      newMetrics.south.lastValueRetrieved = {
        pointId: 'my reference',
        timestamp: testData.constants.dates.DATE_3,
        data: {
          value: 'my value'
        }
      };
      newMetrics.north.lastValueSent = {
        pointId: 'my reference',
        timestamp: testData.constants.dates.DATE_3,
        data: {
          value: 'my value'
        }
      };
      repository.updateMetrics(testData.historyQueries.list[0].id, newMetrics);

      const result = repository.getMetrics(testData.historyQueries.list[0].id)!;
      expect(result.metricsStart).toEqual(newMetrics.metricsStart);
      expect(result.south.numberOfFilesRetrieved).toEqual(newMetrics.south.numberOfFilesRetrieved);
      expect(result.south.lastValueRetrieved).toEqual(newMetrics.south.lastValueRetrieved);

      newMetrics.south.lastValueRetrieved = null;
      newMetrics.north.lastValueSent = null;
      repository.updateMetrics(testData.historyQueries.list[0].id, newMetrics);
      const resultWithoutValue = repository.getMetrics(testData.historyQueries.list[0].id)!;
      expect(resultWithoutValue.south.lastValueRetrieved).toEqual(null);
      expect(resultWithoutValue.north.lastValueSent).toEqual(null);
    });

    it('should remove metrics', () => {
      repository.removeMetrics(testData.historyQueries.list[0].id);
      expect(repository.getMetrics(testData.historyQueries.list[0].id)).toEqual(null);
    });
  });
});

describe('Repository with empty database', () => {
  beforeAll(async () => {
    await initDatabase('logs', false);
  });

  afterAll(async () => {
    await emptyDatabase('logs');
  });

  describe('Engine Metrics', () => {
    let repository: EngineMetricsRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

      repository = new EngineMetricsRepository(database);
    });

    it('should init and get metrics', () => {
      repository.initMetrics(testData.engine.settings.id);
      const result = repository.getMetrics(testData.engine.settings.id);
      expect(result).toEqual({
        metricsStart: testData.constants.dates.FAKE_NOW,
        processCpuUsageInstant: 0,
        processCpuUsageAverage: 0,
        processUptime: 0,
        freeMemory: 0,
        totalMemory: 0,
        minRss: 0,
        currentRss: 0,
        maxRss: 0,
        minHeapTotal: 0,
        currentHeapTotal: 0,
        maxHeapTotal: 0,
        minHeapUsed: 0,
        currentHeapUsed: 0,
        maxHeapUsed: 0,
        minExternal: 0,
        currentExternal: 0,
        maxExternal: 0,
        minArrayBuffers: 0,
        currentArrayBuffers: 0,
        maxArrayBuffers: 0
      });
    });
  });

  describe('South Connector Metrics', () => {
    let repository: SouthConnectorMetricsRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

      repository = new SouthConnectorMetricsRepository(database);
    });

    it('should init and get metrics', () => {
      repository.initMetrics(testData.south.list[0].id);
      const result = repository.getMetrics(testData.south.list[0].id);
      expect(result).toEqual({
        metricsStart: testData.constants.dates.FAKE_NOW,
        lastConnection: null,
        lastRunStart: null,
        lastRunDuration: null,
        numberOfValuesRetrieved: 0,
        numberOfFilesRetrieved: 0,
        lastValueRetrieved: null,
        lastFileRetrieved: null
      });
    });
  });

  describe('North Connector Metrics', () => {
    let repository: NorthConnectorMetricsRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

      repository = new NorthConnectorMetricsRepository(database);
    });

    it('should init and get metrics', () => {
      repository.initMetrics(testData.north.list[0].id);
      const result = repository.getMetrics(testData.north.list[0].id);
      expect(result).toEqual({
        metricsStart: testData.constants.dates.FAKE_NOW,
        lastConnection: null,
        lastRunStart: null,
        lastRunDuration: null,
        numberOfValuesSent: 0,
        numberOfFilesSent: 0,
        lastValueSent: null,
        lastFileSent: null,
        cacheSize: 0
      });
    });
  });

  describe('History Query Metrics', () => {
    let repository: HistoryQueryMetricsRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

      repository = new HistoryQueryMetricsRepository(database);
    });

    it('should init and get metrics', () => {
      repository.initMetrics(testData.historyQueries.list[0].id);
      const result = repository.getMetrics(testData.historyQueries.list[0].id);
      expect(result).toEqual({
        metricsStart: testData.constants.dates.FAKE_NOW,
        north: {
          lastConnection: null,
          lastRunStart: null,
          lastRunDuration: null,
          numberOfValuesSent: 0,
          numberOfFilesSent: 0,
          lastValueSent: null,
          lastFileSent: null,
          cacheSize: 0
        },
        south: {
          lastConnection: null,
          lastRunStart: null,
          lastRunDuration: null,
          numberOfValuesRetrieved: 0,
          numberOfFilesRetrieved: 0,
          lastValueRetrieved: null,
          lastFileRetrieved: null
        },
        historyMetrics: {
          running: false,
          intervalProgress: 0,
          currentIntervalStart: null,
          currentIntervalEnd: null,
          currentIntervalNumber: 0,
          numberOfIntervals: 0
        }
      });
    });
  });
});
