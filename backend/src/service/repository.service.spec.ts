import db from 'better-sqlite3';

import RepositoryService from './repository.service';

import EngineRepository from '../repository/config/engine.repository';
import IpFilterRepository from '../repository/config/ip-filter.repository';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import LogRepository from '../repository/logs/log.repository';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import UserRepository from '../repository/config/user.repository';
import CryptoRepository from '../repository/crypto/crypto.repository';
import SouthConnectorMetricsRepository from '../repository/metrics/south-connector-metrics.repository';
import EngineMetricsRepository from '../repository/metrics/engine-metrics.repository';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import NorthConnectorMetricsRepository from '../repository/metrics/north-connector-metrics.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import OianalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import OianalyticsCommandRepository from '../repository/config/oianalytics-command.repository';
import OianalyticsMessageRepository from '../repository/config/oianalytics-message.repository';
import HistoryQueryMetricsRepository from '../repository/metrics/history-query-metrics.repository';

const mockedDatabase = {
  file: 'mocked-db.db',
  pragma: jest.fn(),
  close: jest.fn()
};
jest.mock('better-sqlite3', () => jest.fn(() => mockedDatabase));
jest.mock('../repository/crypto/crypto.repository');
jest.mock('../repository/config/ip-filter.repository');
jest.mock('../repository/config/scan-mode.repository');
jest.mock('../repository/config/engine.repository');
jest.mock('../repository/config/north-connector.repository');
jest.mock('../repository/metrics/north-connector-metrics.repository');
jest.mock('../repository/config/south-connector.repository');
jest.mock('../repository/cache/south-cache.repository');
jest.mock('../repository/metrics/south-connector-metrics.repository');
jest.mock('../repository/metrics/history-query-metrics.repository');
jest.mock('../repository/metrics/engine-metrics.repository');
jest.mock('../repository/logs/log.repository');
jest.mock('../repository/config/history-query.repository');
jest.mock('../repository/config/user.repository');
jest.mock('../repository/config/certificate.repository');
jest.mock('../repository/config/oianalytics-registration.repository');
jest.mock('../repository/config/oianalytics-command.repository');
jest.mock('../repository/config/oianalytics-message.repository');

describe('Repository service', () => {
  it('should properly initialize service', () => {
    const repositoryService = new RepositoryService(
      'myConfigDatabase',
      'myLogDatabase',
      'myMetricsDatabase',
      'myCryptoDatabase',
      'myCacheDatabase',
      '3.5.0'
    );
    expect(db).toHaveBeenCalledWith('myConfigDatabase');
    expect(db).toHaveBeenCalledWith('myCryptoDatabase');
    expect(db).toHaveBeenCalledWith('myCacheDatabase');
    expect(db).toHaveBeenCalledWith('myMetricsDatabase');
    expect(db).toHaveBeenCalledWith('myLogDatabase');
    expect(mockedDatabase.pragma).toHaveBeenCalledWith('journal_mode = WAL');
    expect(mockedDatabase.pragma).toHaveBeenCalledWith('busy_timeout = 5000');
    expect(EngineRepository).toHaveBeenCalledWith(mockedDatabase, '3.5.0');
    expect(CryptoRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(IpFilterRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(ScanModeRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(NorthConnectorRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(NorthConnectorMetricsRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(SouthConnectorRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(SouthConnectorMetricsRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(HistoryQueryMetricsRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(EngineMetricsRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(SouthCacheRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(LogRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(HistoryQueryRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(UserRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(OianalyticsRegistrationRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(CertificateRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(OianalyticsCommandRepository).toHaveBeenCalledWith(mockedDatabase);
    expect(OianalyticsMessageRepository).toHaveBeenCalledWith(mockedDatabase);

    expect(repositoryService.engineRepository).toBeDefined();
    expect(repositoryService.cryptoRepository).toBeDefined();
    expect(repositoryService.ipFilterRepository).toBeDefined();
    expect(repositoryService.scanModeRepository).toBeDefined();
    expect(repositoryService.northConnectorRepository).toBeDefined();
    expect(repositoryService.northMetricsRepository).toBeDefined();
    expect(repositoryService.southConnectorRepository).toBeDefined();
    expect(repositoryService.southMetricsRepository).toBeDefined();
    expect(repositoryService.historyQueryMetricsRepository).toBeDefined();
    expect(repositoryService.engineMetricsRepository).toBeDefined();
    expect(repositoryService.oianalyticsRegistrationRepository).toBeDefined();
    expect(repositoryService.southCacheRepository).toBeDefined();
    expect(repositoryService.logRepository).toBeDefined();
    expect(repositoryService.historyQueryRepository).toBeDefined();
    expect(repositoryService.userRepository).toBeDefined();
    expect(repositoryService.certificateRepository).toBeDefined();
    expect(repositoryService.oianalyticsCommandRepository).toBeDefined();
    expect(repositoryService.oianalyticsMessageRepository).toBeDefined();
  });

  it('should properly close', () => {
    const repositoryService = new RepositoryService(
      'myConfigDatabase',
      'myLogDatabase',
      'myMetricsDatabase',
      'myCryptoDatabase',
      'myCacheDatabase',
      '3.5.0'
    );

    repositoryService.close();
    expect(mockedDatabase.close).toHaveBeenCalledTimes(5);
  });
});
