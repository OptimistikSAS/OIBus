import OIBusService from './oibus.service';
import OIBusEngine from '../engine/oibus-engine';
import OibusEngineMock from '../tests/__mocks__/oibus-engine.mock';
import HistoryQueryEngine from '../engine/history-query-engine';
import HistoryQueryEngineMock from '../tests/__mocks__/history-query-engine.mock';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import EngineRepository from '../repository/engine.repository';
import EngineMetricsRepositoryMock from '../tests/__mocks__/repository/engine-metrics-repository.mock';
import EngineRepositoryMock from '../tests/__mocks__/repository/engine-repository.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import EncryptionService from './encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import LoggerService from './logger/logger.service';
import LoggerServiceMock from '../tests/__mocks__/service/logger/logger-service.mock';
import OIAnalyticsRegistrationRepository from '../repository/oianalytics-registration.repository';
import OIAnalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/oianalytics-registration-repository.mock';
import EngineMetricsRepository from '../repository/engine-metrics.repository';
import os from 'node:os';
import IpFilterRepository from '../repository/ip-filter.repository';
import IpFilterRepositoryMock from '../tests/__mocks__/repository/ip-filter-repository.mock';
import testData from '../tests/utils/test-data';
import { EngineSettings } from '../model/engine.model';
import { EngineSettingsCommandDTO } from '../../../shared/model/engine.model';
import { getOIBusInfo } from './utils';

jest.mock('./utils');
jest.mock('../web-server/proxy-server');

const validator = new JoiValidator();
const engineRepository: EngineRepository = new EngineRepositoryMock();
const engineMetricsRepository: EngineMetricsRepository = new EngineMetricsRepositoryMock();
const ipFilterRepository: IpFilterRepository = new IpFilterRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();
const encryptionService: EncryptionService = new EncryptionServiceMock();
const loggerService: LoggerService = new LoggerServiceMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OianalyticsMessageServiceMock();
const engine: OIBusEngine = new OibusEngineMock();
const historyQueryEngine: HistoryQueryEngine = new HistoryQueryEngineMock();
const logger: pino.Logger = new PinoLogger();

const nowDateString = '2020-02-02T02:02:02.222Z';

let service: OIBusService;
describe('OIBus service with enabled proxy server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    jest.spyOn(process, 'cpuUsage').mockReturnValue({ user: 1000, system: 1000 });

    (engineRepository.get as jest.Mock).mockReturnValue(testData.engine.settings);
    (engineMetricsRepository.getMetrics as jest.Mock).mockReturnValue(testData.engine.metrics);
    (loggerService.createChildLogger as jest.Mock).mockReturnValue(logger);
    (ipFilterRepository.findAll as jest.Mock).mockReturnValue(testData.ipFilters.list);

    service = new OIBusService(
      validator,
      engineRepository,
      engineMetricsRepository,
      ipFilterRepository,
      oIAnalyticsRegistrationRepository,
      encryptionService,
      loggerService,
      oIAnalyticsMessageService,
      engine,
      historyQueryEngine
    );
  });

  it('should start OIBus and stop it', async () => {
    await service.startOIBus();

    expect(engine.start).toHaveBeenCalled();
    expect(historyQueryEngine.start).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
    expect(service.getProxyServer()).toBeDefined();

    await service.stopOIBus();

    expect(engine.stop).toHaveBeenCalled();
    expect(historyQueryEngine.stop).toHaveBeenCalled();
  });

  it('should stop OIBus without starting', async () => {
    await service.stopOIBus();
    expect(engine.stop).toHaveBeenCalled();
    expect(historyQueryEngine.stop).toHaveBeenCalled();
  });

  it('should add content', async () => {
    await service.addExternalContent('northId', { type: 'time-values', content: [] });
    expect(engine.addExternalContent).toHaveBeenCalledWith('northId', { type: 'time-values', content: [] });
  });

  it('should set logger', () => {
    service.setLogger(logger);
    expect(engine.setLogger).toHaveBeenCalledWith(logger);
    expect(historyQueryEngine.setLogger).toHaveBeenCalledWith(logger);
    expect(oIAnalyticsMessageService.setLogger).toHaveBeenCalledWith(logger);
  });

  it('should correctly update settings and call callback methods', async () => {
    const newEngineSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    newEngineSettings.name = 'updated oibus';
    newEngineSettings.proxyEnabled = true;
    const specificCommand: EngineSettingsCommandDTO = JSON.parse(JSON.stringify(testData.engine.command));
    specificCommand.logParameters.loki.password = 'updated password';
    (engineRepository.get as jest.Mock).mockReturnValueOnce(testData.engine.settings).mockReturnValueOnce(newEngineSettings);
    const webServerChangePortCallbackMock = jest.fn();
    const webServerChangeLoggerCallbackMock = jest.fn();

    service.setWebServerChangeLogger(webServerChangeLoggerCallbackMock);
    service.setWebServerChangePort(webServerChangePortCallbackMock);
    await service.updateEngineSettings(specificCommand);

    expect(engineRepository.get).toHaveBeenCalledTimes(3);
    expect(encryptionService.encryptText).toHaveBeenCalledTimes(1);
    expect(engineRepository.update).toHaveBeenCalled();
    expect(loggerService.stop).toHaveBeenCalled();
    expect(loggerService.start).toHaveBeenCalled();
    expect(loggerService.createChildLogger).toHaveBeenCalledTimes(3); // in constructor and 2x at update
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(webServerChangeLoggerCallbackMock).toHaveBeenCalled();
    expect(webServerChangePortCallbackMock).toHaveBeenCalled();
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
    await service.updateEngineSettings(specificTestCommand);

    expect(engineRepository.get).toHaveBeenCalledTimes(3);
    expect(encryptionService.encryptText).not.toHaveBeenCalled();
    expect(engineRepository.update).toHaveBeenCalled();
  });

  it('should correctly update settings without reloading logger', async () => {
    const specificTestCommand: Omit<EngineSettings, 'id' | 'version'> = JSON.parse(JSON.stringify(testData.engine.command));
    specificTestCommand.logParameters = JSON.parse(JSON.stringify(testData.engine.settings.logParameters));

    await service.updateEngineSettings(specificTestCommand);

    expect(loggerService.stop).not.toHaveBeenCalled();
    expect(loggerService.start).not.toHaveBeenCalled();
    expect(loggerService.createChildLogger).toHaveBeenCalledTimes(1); // in constructor
  });

  it('should correctly restart OIBus', async () => {
    await service.restartOIBus();

    expect(engine.stop).toHaveBeenCalled();
    expect(historyQueryEngine.stop).toHaveBeenCalled();
    expect(engine.start).toHaveBeenCalled();
    expect(historyQueryEngine.start).toHaveBeenCalled();
  });

  it('should log health signal', async () => {
    await service.startOIBus();
    expect(logger.info).toHaveBeenCalledTimes(3); // starting, health info, started

    service.logHealthSignal();
    expect(logger.info).toHaveBeenCalledTimes(4);

    jest.advanceTimersByTime(60_000_000);
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

    await service.startOIBus();

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

    service.updateMetrics = jest.fn();

    service.resetMetrics();
    expect(engineMetricsRepository.removeMetrics).toHaveBeenCalledWith(testData.engine.settings.id);
    expect(engineMetricsRepository.initMetrics).toHaveBeenCalledWith(testData.engine.settings.id);
    expect(service.updateMetrics).toHaveBeenCalled();
  });

  it('should get stream', () => {
    const stream = service.stream;
    stream.write = jest.fn();
    jest.advanceTimersByTime(100);
    expect(stream.write).toHaveBeenCalledTimes(1);

    service.updateMetrics();
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

    expect(service.getOIBusInfo()).toEqual(testData.engine.oIBusInfo);
  });

  it('should update OIBus version', () => {
    service.updateOIBusVersion('3.4.0');
    expect(engineRepository.updateVersion).toHaveBeenCalledWith('3.4.0');
  });
});
