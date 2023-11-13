import db from 'better-sqlite3';

import RepositoryService from './repository.service';

import EngineRepository from '../repository/engine.repository';
import ExternalSourceRepository from '../repository/external-source.repository';
import IpFilterRepository from '../repository/ip-filter.repository';
import ScanModeRepository from '../repository/scan-mode.repository';
import SouthConnectorRepository from '../repository/south-connector.repository';
import SouthItemRepository from '../repository/south-item.repository';
import NorthConnectorRepository from '../repository/north-connector.repository';
import LogRepository from '../repository/log.repository';
import HistoryQueryRepository from '../repository/history-query.repository';
import HistoryQueryItemRepository from '../repository/history-query-item.repository';
import UserRepository from '../repository/user.repository';
import SubscriptionRepository from '../repository/subscription.repository';
import CryptoRepository from '../repository/crypto.repository';
import SouthConnectorMetricsRepository from '../repository/south-connector-metrics.repository';
import EngineMetricsRepository from '../repository/engine-metrics.repository';
import SouthCacheRepository from '../repository/south-cache.repository';
import NorthConnectorMetricsRepository from '../repository/north-connector-metrics.repository';
import CertificateRepository from '../repository/certificate.repository';
import RegistrationRepository from '../repository/registration.repository';

jest.mock('better-sqlite3', () => jest.fn(() => 'sqlite database'));
jest.mock('../repository/external-source.repository');
jest.mock('../repository/crypto.repository');
jest.mock('../repository/ip-filter.repository');
jest.mock('../repository/scan-mode.repository');
jest.mock('../repository/engine.repository');
jest.mock('../repository/north-connector.repository');
jest.mock('../repository/north-connector-metrics.repository');
jest.mock('../repository/south-connector.repository');
jest.mock('../repository/south-cache.repository');
jest.mock('../repository/south-connector-metrics.repository');
jest.mock('../repository/engine-metrics.repository');
jest.mock('../repository/south-item.repository');
jest.mock('../repository/log.repository');
jest.mock('../repository/history-query.repository');
jest.mock('../repository/history-query-item.repository');
jest.mock('../repository/user.repository');
jest.mock('../repository/subscription.repository');
jest.mock('../repository/certificate.repository');
jest.mock('../repository/registration.repository');

describe('Repository service', () => {
  it('should properly initialize service', () => {
    const repositoryService = new RepositoryService('myConfigDatabase', 'myLogDatabase', 'myCryptoDatabase', 'myCacheDatabase');
    expect(db).toHaveBeenCalledWith('myConfigDatabase');
    expect(db).toHaveBeenCalledWith('myLogDatabase');
    expect(db).toHaveBeenCalledWith('myCryptoDatabase');
    expect(db).toHaveBeenCalledWith('myCacheDatabase');
    expect(EngineRepository).toHaveBeenCalledWith('sqlite database');
    expect(CryptoRepository).toHaveBeenCalledWith('sqlite database');
    expect(ExternalSourceRepository).toHaveBeenCalledWith('sqlite database');
    expect(IpFilterRepository).toHaveBeenCalledWith('sqlite database');
    expect(ScanModeRepository).toHaveBeenCalledWith('sqlite database');
    expect(NorthConnectorRepository).toHaveBeenCalledWith('sqlite database');
    expect(NorthConnectorMetricsRepository).toHaveBeenCalledWith('sqlite database');
    expect(SouthConnectorRepository).toHaveBeenCalledWith('sqlite database');
    expect(SouthConnectorMetricsRepository).toHaveBeenCalledWith('sqlite database');
    expect(EngineMetricsRepository).toHaveBeenCalledWith('sqlite database');
    expect(SouthCacheRepository).toHaveBeenCalledWith('sqlite database');
    expect(SouthItemRepository).toHaveBeenCalledWith('sqlite database');
    expect(LogRepository).toHaveBeenCalledWith('sqlite database');
    expect(HistoryQueryRepository).toHaveBeenCalledWith('sqlite database');
    expect(HistoryQueryItemRepository).toHaveBeenCalledWith('sqlite database');
    expect(UserRepository).toHaveBeenCalledWith('sqlite database');
    expect(SubscriptionRepository).toHaveBeenCalledWith('sqlite database');
    expect(RegistrationRepository).toHaveBeenCalledWith('sqlite database');
    expect(CertificateRepository).toHaveBeenCalledWith('sqlite database');

    expect(repositoryService.engineRepository).toBeDefined();
    expect(repositoryService.cryptoRepository).toBeDefined();
    expect(repositoryService.externalSourceRepository).toBeDefined();
    expect(repositoryService.ipFilterRepository).toBeDefined();
    expect(repositoryService.scanModeRepository).toBeDefined();
    expect(repositoryService.northConnectorRepository).toBeDefined();
    expect(repositoryService.northMetricsRepository).toBeDefined();
    expect(repositoryService.southConnectorRepository).toBeDefined();
    expect(repositoryService.southItemRepository).toBeDefined();
    expect(repositoryService.southMetricsRepository).toBeDefined();
    expect(repositoryService.engineMetricsRepository).toBeDefined();
    expect(repositoryService.registrationRepository).toBeDefined();
    expect(repositoryService.southCacheRepository).toBeDefined();
    expect(repositoryService.logRepository).toBeDefined();
    expect(repositoryService.historyQueryRepository).toBeDefined();
    expect(repositoryService.historyQueryItemRepository).toBeDefined();
    expect(repositoryService.userRepository).toBeDefined();
    expect(repositoryService.subscriptionRepository).toBeDefined();
    expect(repositoryService.certificateRepository).toBeDefined();
  });
});
