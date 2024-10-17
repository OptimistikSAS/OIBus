import HistoryQueryService from './history-query.service';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import HistoryQueryRepositoryMock from '../tests/__mocks__/repository/config/history-query-repository.mock';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import SouthService from './south.service';
import NorthService from './north.service';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import EncryptionService from './encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import SouthConnectorMetricsRepository from '../repository/logs/south-connector-metrics.repository';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';
import SouthMetricsRepositoryMock from '../tests/__mocks__/repository/log/south-metrics-repository.mock';
import NorthMetricsRepositoryMock from '../tests/__mocks__/repository/log/north-metrics-repository.mock';
import HistoryQueryEngine from '../engine/history-query-engine';
import HistoryQueryEngineMock from '../tests/__mocks__/history-query-engine.mock';

const validator = new JoiValidator();
const historyQueryRepository: HistoryQueryRepository = new HistoryQueryRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const logRepository: LogRepository = new LogRepositoryMock();
const southMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const northMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const historyQueryEngine: HistoryQueryEngine = new HistoryQueryEngineMock();

let service: HistoryQueryService;
describe('history query service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new HistoryQueryService(
      validator,
      historyQueryRepository,
      scanModeRepository,
      logRepository,
      southMetricsRepository,
      northMetricsRepository,
      southService,
      northService,
      oIAnalyticsMessageService,
      encryptionService,
      historyQueryEngine
    );
  });

  it('should get a History query settings', () => {
    service.findById('historyId');
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledTimes(1);
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith('historyId');
  });

  it('should get all History queries settings', () => {
    service.findAll();
    expect(historyQueryRepository.findAllHistoryQueries).toHaveBeenCalledTimes(1);
  });
});
