import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import OIBusService, { toEngineSettingsDTO } from './oibus.service';
import DataStreamEngine from '../engine/data-stream-engine';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import EngineRepository from '../repository/config/engine.repository';
import EngineMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/engine-metrics-repository.mock';
import EngineRepositoryMock from '../tests/__mocks__/repository/config/engine-repository.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import { encryptionService } from './encryption.service';
import LoggerService from './logger/logger.service';
import LoggerServiceMock from '../tests/__mocks__/service/logger/logger-service.mock';
import EngineMetricsRepository from '../repository/metrics/engine-metrics.repository';
import os from 'node:os';
import testData from '../tests/utils/test-data';
import { EngineSettings } from '../model/engine.model';
import { EngineSettingsCommandDTO } from '../../shared/model/engine.model';
import { getOIBusInfo } from './utils';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import SouthService from './south.service';
import NorthService from './north.service';
import HistoryQueryService from './history-query.service';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';
import HistoryQueryServiceMock from '../tests/__mocks__/service/history-query-service.mock';
import OIAnalyticsRegistrationService from './oia/oianalytics-registration.service';
import OIAnalyticsRegistrationServiceMock from '../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import IPFilterService from './ip-filter.service';
import IpFilterServiceMock from '../tests/__mocks__/service/ip-filter-service.mock';

jest.mock('./utils');
jest.mock('../web-server/proxy-server');
jest.mock('./encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const validator = new JoiValidator();
const engineRepository: EngineRepository = new EngineRepositoryMock();
const engineMetricsRepository: EngineMetricsRepository = new EngineMetricsRepositoryMock();
const ipFilterService: IPFilterService = new IpFilterServiceMock();
const oIAnalyticsRegistrationService: OIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
const loggerService: LoggerService = new LoggerServiceMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OianalyticsMessageServiceMock();
const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();
const historyQueryService: HistoryQueryService = new HistoryQueryServiceMock();
const logger: pino.Logger = new PinoLogger();
const engine: DataStreamEngine = new DataStreamEngineMock(logger);

let service: OIBusService;
describe('OIBus Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    jest.spyOn(process, 'cpuUsage').mockReturnValue({ user: 1000, system: 1000 });

    (engineRepository.get as jest.Mock).mockReturnValue(testData.engine.settings);
    (engineMetricsRepository.getMetrics as jest.Mock).mockReturnValue(testData.engine.metrics);
    (loggerService.createChildLogger as jest.Mock).mockReturnValue(logger);
    (ipFilterService.list as jest.Mock).mockReturnValue(testData.ipFilters.list);

    service = new OIBusService(
      validator,
      engineRepository,
      engineMetricsRepository,
      ipFilterService,
      oIAnalyticsRegistrationService,
      loggerService,
      oIAnalyticsMessageService,
      southService,
      northService,
      historyQueryService,
      engine,
      false
    );
  });

  afterEach(() => {
    oIAnalyticsRegistrationService.registrationEvent.removeAllListeners();
    ipFilterService.whiteListEvent.removeAllListeners();
  });

  it('should start OIBus and stop it', async () => {
    (northService.list as jest.Mock).mockReturnValue(testData.north.list);
    (southService.list as jest.Mock).mockReturnValue(testData.south.list);
    (historyQueryService.list as jest.Mock).mockReturnValue(testData.historyQueries.list);
    (southService.findById as jest.Mock).mockImplementation(id => testData.south.list.find(element => element.id === id));
    (northService.findById as jest.Mock).mockImplementation(id => testData.north.list.find(element => element.id === id));
    (historyQueryService.findById as jest.Mock).mockImplementation(id => testData.historyQueries.list.find(element => element.id === id));

    await service.start();

    expect(engine.start).toHaveBeenCalledWith(testData.north.list, testData.south.list, testData.historyQueries.list);
    expect(logger.info).toHaveBeenCalledWith('Starting OIBus...');
    expect(service.getProxyServer()).toBeDefined();
    expect(ipFilterService.list).toHaveBeenCalledTimes(1);

    const settingsWithoutOIAlog: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    settingsWithoutOIAlog.logParameters.oia.level = 'silent';
    (engineRepository.get as jest.Mock).mockReturnValueOnce(settingsWithoutOIAlog).mockReturnValueOnce(testData.engine.settings);
    service.resetLogger = jest.fn();

    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    expect(service.resetLogger).not.toHaveBeenCalled();

    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    expect(service.resetLogger).toHaveBeenCalledWith(testData.engine.settings);

    jest.clearAllMocks();
    settingsWithoutOIAlog.proxyEnabled = false;
    (engineRepository.get as jest.Mock).mockReturnValueOnce(settingsWithoutOIAlog).mockReturnValueOnce(testData.engine.settings);
    ipFilterService.whiteListEvent.emit('update-white-list');
    expect(service.getProxyServer().refreshIpFilters).not.toHaveBeenCalled();
    ipFilterService.whiteListEvent.emit('update-white-list');
    expect(service.getProxyServer().refreshIpFilters).toHaveBeenCalled();

    await service.stop();

    expect(engine.stop).toHaveBeenCalled();
  });

  it('should start OIBus without proxy', async () => {
    (northService.list as jest.Mock).mockReturnValue([]);
    (southService.list as jest.Mock).mockReturnValue([]);
    (historyQueryService.list as jest.Mock).mockReturnValue([]);
    const settingsWithoutProxy: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    settingsWithoutProxy.proxyEnabled = false;
    (engineRepository.get as jest.Mock).mockReturnValue(settingsWithoutProxy);

    await service.start();
    expect(ipFilterService.list).not.toHaveBeenCalled();
  });

  it('should stop OIBus without starting', async () => {
    await service.stop();
    expect(engine.stop).toHaveBeenCalled();
  });

  it('should add content', async () => {
    await service.addExternalContent('northId', { type: 'time-values', content: [] });
    expect(engine.addExternalContent).toHaveBeenCalledWith('northId', { type: 'time-values', content: [] });
  });

  it('should set logger', () => {
    service.setLogger(logger);
    expect(engine.setLogger).toHaveBeenCalledWith(logger);
    expect(oIAnalyticsMessageService.setLogger).toHaveBeenCalledWith(logger);
  });

  it('should correctly update settings and call callback methods', async () => {
    const newEngineSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    newEngineSettings.name = 'updated oibus';
    newEngineSettings.proxyEnabled = true;
    newEngineSettings.port = 999;
    const specificCommand: EngineSettingsCommandDTO = JSON.parse(JSON.stringify(testData.engine.command));
    specificCommand.logParameters.loki.password = 'updated password';
    specificCommand.port = 999;
    (engineRepository.get as jest.Mock).mockReturnValueOnce(testData.engine.settings).mockReturnValueOnce(newEngineSettings);

    // Spy on the portChangeEvent
    const portChangeEmitSpy = jest.spyOn(service.portChangeEvent, 'emit');

    // Temporarily use real timers for setImmediate
    jest.useRealTimers();

    const result = await service.updateEngineSettings(specificCommand);

    expect(result).toEqual({
      needsRedirect: true,
      newPort: 999
    });
    expect(engineRepository.get).toHaveBeenCalledTimes(3);
    expect(encryptionService.encryptText).toHaveBeenCalledTimes(1);
    expect(engineRepository.update).toHaveBeenCalled();
    expect(loggerService.stop).toHaveBeenCalled();
    expect(loggerService.start).toHaveBeenCalled();
    expect(loggerService.createChildLogger).toHaveBeenCalledTimes(3); // in constructor and 2x at update
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();

    // Wait for setImmediate callback to execute
    await new Promise(resolve => setImmediate(resolve));

    // Verify port change event was emitted
    expect(portChangeEmitSpy).toHaveBeenCalledWith('updated', 999);

    // Restore fake timers
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('should throw error if bad port configuration', async () => {
    await expect(service.updateEngineSettings({ ...testData.engine.command, proxyPort: testData.engine.command.port })).rejects.toThrow(
      'Web server port and proxy port can not be the same'
    );

    expect(engineRepository.update).not.toHaveBeenCalled();
  });

  it('should correctly update settings without encrypting password', async () => {
    const specificTestCommand: Omit<EngineSettings, 'id' | 'version'> = JSON.parse(JSON.stringify(testData.engine.command));
    specificTestCommand.logParameters.loki.password = '';
    specificTestCommand.proxyEnabled = false;

    (engineRepository.get as jest.Mock).mockReturnValueOnce(testData.engine.settings).mockReturnValueOnce(specificTestCommand);
    const result = await service.updateEngineSettings(specificTestCommand);

    expect(result).toEqual({
      needsRedirect: false,
      newPort: null
    });
    expect(engineRepository.get).toHaveBeenCalledTimes(3);
    expect(encryptionService.encryptText).not.toHaveBeenCalled();
    expect(engineRepository.update).toHaveBeenCalled();
  });

  it('should correctly update settings without reloading logger', async () => {
    const specificTestCommand: Omit<EngineSettings, 'id' | 'version'> = JSON.parse(JSON.stringify(testData.engine.command));
    specificTestCommand.logParameters = JSON.parse(JSON.stringify(testData.engine.settings.logParameters));

    const result = await service.updateEngineSettings(specificTestCommand);

    expect(result).toEqual({
      needsRedirect: false,
      newPort: null
    });
    expect(loggerService.stop).not.toHaveBeenCalled();
    expect(loggerService.start).not.toHaveBeenCalled();
    expect(loggerService.createChildLogger).toHaveBeenCalledTimes(1); // in constructor
  });

  it('should correctly restart OIBus', async () => {
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

    await service.restart();
    jest.advanceTimersByTime(100);
    expect(processExitSpy).toHaveBeenCalledTimes(1);
  });

  it('should log health signal', async () => {
    await service.start();
    expect(logger.info).toHaveBeenCalledTimes(3); // starting, health info, started

    service.logHealthSignal();
    expect(logger.info).toHaveBeenCalledTimes(4);

    jest.advanceTimersByTime(1_800_000);
    expect(logger.info).toHaveBeenCalledTimes(5);
  });

  it('should update and reset metrics', async () => {
    jest.spyOn(process, 'uptime').mockReturnValue(10000);
    jest.spyOn(os, 'freemem').mockReturnValue(2_000_000);
    jest.spyOn(os, 'totalmem').mockReturnValue(16_000_000);
    jest
      .spyOn(process, 'memoryUsage')
      .mockReturnValueOnce({ rss: 5, heapTotal: 5, heapUsed: 5, external: 5, arrayBuffers: 5 })
      .mockReturnValueOnce({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 })
      .mockReturnValueOnce({ rss: 10, heapTotal: 10, heapUsed: 10, external: 10, arrayBuffers: 10 })
      .mockReturnValueOnce({ rss: 5, heapTotal: 5, heapUsed: 5, external: 5, arrayBuffers: 5 });

    await service.start();

    expect(engineMetricsRepository.updateMetrics).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(1000);

    expect(engineMetricsRepository.updateMetrics).toHaveBeenCalledTimes(4);
    expect(engineMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.engine.settings.id, {
      metricsStart: '2020-01-01T00:00:00.000',
      processCpuUsageInstant: 0,
      processCpuUsageAverage: 0.0000002,
      processUptime: 10000000,
      freeMemory: 2_000_000,
      totalMemory: 16_000_000,
      minRss: 0,
      currentRss: 5,
      maxRss: 10,
      minHeapTotal: 0,
      currentHeapTotal: 5,
      maxHeapTotal: 10,
      minHeapUsed: 0,
      currentHeapUsed: 5,
      maxHeapUsed: 10,
      minExternal: 0,
      currentExternal: 5,
      maxExternal: 10,
      minArrayBuffers: 0,
      currentArrayBuffers: 5,
      maxArrayBuffers: 10
    });

    service.updateEngineMetrics = jest.fn();

    service.resetEngineMetrics();
    expect(engineMetricsRepository.removeMetrics).toHaveBeenCalledWith(testData.engine.settings.id);
    expect(engineMetricsRepository.initMetrics).toHaveBeenCalledWith(testData.engine.settings.id);
    expect(service.updateEngineMetrics).toHaveBeenCalled();
  });

  it('should get stream', () => {
    const stream = service.stream;
    stream.write = jest.fn();
    jest.advanceTimersByTime(100);
    expect(stream.write).toHaveBeenCalledTimes(1);

    service.updateEngineMetrics();
    expect(stream.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        metricsStart: '2020-01-01T00:00:00.000',
        processCpuUsageInstant: 0,
        processCpuUsageAverage: 0.0000002,
        processUptime: 10000,
        freeMemory: 2_000_000,
        totalMemory: 16_000_000,
        minRss: 5,
        currentRss: 5,
        maxRss: 5,
        minHeapTotal: 5,
        currentHeapTotal: 5,
        maxHeapTotal: 5,
        minHeapUsed: 5,
        currentHeapUsed: 5,
        maxHeapUsed: 5,
        minExternal: 5,
        currentExternal: 5,
        maxExternal: 5,
        minArrayBuffers: 5,
        currentArrayBuffers: 5,
        maxArrayBuffers: 5
      })}\n\n`
    );

    expect(service.stream).toBeDefined();
  });

  it('should get OIBus info', () => {
    (getOIBusInfo as jest.Mock).mockReturnValueOnce(testData.engine.oIBusInfo);

    expect(service.getInfo()).toEqual(testData.engine.oIBusInfo);
  });

  it('should update OIBus version', () => {
    service.updateOIBusVersion('3.4.9', '3.4.5');
    expect(engineRepository.updateVersion).toHaveBeenCalledWith('3.4.9', '3.4.5');
  });

  it('should reset North Connector Metrics', () => {
    service.resetNorthMetrics('id');
    expect(engine.resetNorthMetrics).toHaveBeenCalledWith('id');
  });

  it('should reset South Connector Metrics', () => {
    service.resetSouthMetrics('id');
    expect(engine.resetSouthMetrics).toHaveBeenCalledWith('id');
  });

  it('should properly convert to DTO', () => {
    const engineSettings = testData.engine.settings;
    expect(toEngineSettingsDTO(engineSettings)).toEqual({
      id: engineSettings.id,
      name: engineSettings.name,
      port: engineSettings.port,
      version: engineSettings.version,
      launcherVersion: engineSettings.launcherVersion,
      proxyEnabled: engineSettings.proxyEnabled,
      proxyPort: engineSettings.proxyPort,
      logParameters: {
        console: {
          level: engineSettings.logParameters.console.level
        },
        file: {
          level: engineSettings.logParameters.file.level,
          maxFileSize: engineSettings.logParameters.file.maxFileSize,
          numberOfFiles: engineSettings.logParameters.file.numberOfFiles
        },
        database: {
          level: engineSettings.logParameters.database.level,
          maxNumberOfLogs: engineSettings.logParameters.database.maxNumberOfLogs
        },

        loki: {
          level: engineSettings.logParameters.loki.level,
          interval: engineSettings.logParameters.loki.interval,
          address: engineSettings.logParameters.loki.address,
          username: engineSettings.logParameters.loki.username,
          password: ''
        },
        oia: {
          level: engineSettings.logParameters.oia.level,
          interval: engineSettings.logParameters.oia.interval
        }
      }
    });
  });
});
