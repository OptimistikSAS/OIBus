import SouthMetricsRepositoryMock from '../repository/log/south-metrics-repository.mock';
import NorthMetricsRepositoryMock from '../repository/log/north-metrics-repository.mock';
import ScanModeRepositoryMock from '../repository/config/scan-mode-repository.mock';
import SouthConnectorRepositoryMock from '../repository/config/south-connector-repository.mock';
import NorthConnectorRepositoryMock from '../repository/config/north-connector-repository.mock';
import IpFilterRepositoryMock from '../repository/config/ip-filter-repository.mock';
import CryptoRepositoryMock from '../repository/crypto/crypto-repository.mock';
import HistoryQueryRepositoryMock from '../repository/config/history-query-repository.mock';
import CertificateRepositoryMock from '../repository/config/certificate-repository.mock';
import OianalyticsRegistrationRepositoryMock from '../repository/config/oianalytics-registration-repository.mock';
import UserRepositoryMock from '../repository/config/user-repository.mock';
import LogRepositoryMock from '../repository/log/log-repository.mock';
import OianalyticsMessageRepositoryMock from '../repository/config/oianalytics-message-repository.mock';
import EngineRepositoryMock from '../repository/config/engine-repository.mock';
import SouthCacheRepositoryMock from '../repository/cache/south-cache-repository.mock';

/**
 * Create a mock object for Repository Service
 */
export default jest.fn().mockImplementation(() => ({
  northConnectorRepository: new NorthConnectorRepositoryMock(),
  southConnectorRepository: new SouthConnectorRepositoryMock(),
  historyQueryRepository: new HistoryQueryRepositoryMock(),
  ipFilterRepository: new IpFilterRepositoryMock(),
  scanModeRepository: new ScanModeRepositoryMock(),
  certificateRepository: new CertificateRepositoryMock(),
  oianalyticsRegistrationRepository: new OianalyticsRegistrationRepositoryMock(),
  userRepository: new UserRepositoryMock(),
  logRepository: new LogRepositoryMock(),
  oianalyticsCommandRepository: new OianalyticsRegistrationRepositoryMock(),
  oianalyticsMessageRepository: new OianalyticsMessageRepositoryMock(),
  engineRepository: new EngineRepositoryMock(),
  cryptoRepository: new CryptoRepositoryMock(),
  southMetricsRepository: new SouthMetricsRepositoryMock(),
  northMetricsRepository: new NorthMetricsRepositoryMock(),
  southCacheRepository: new SouthCacheRepositoryMock()
}));
