import db from 'better-sqlite3';

import RepositoryService from './repository.service';

import EngineRepository from '../repository/engine.repository';
import ExternalSourceRepository from '../repository/external-source.repository';
import IpFilterRepository from '../repository/ip-filter.repository';
import ProxyRepository from '../repository/proxy.repository';
import ScanModeRepository from '../repository/scan-mode.repository';
import SouthConnectorRepository from '../repository/south-connector.repository';
import SouthItemRepository from '../repository/south-item.repository';
import NorthConnectorRepository from '../repository/north-connector.repository';
import LogRepository from '../repository/log.repository';
import HistoryQueryRepository from '../repository/history-query.repository';
import HistoryQueryItemRepository from '../repository/history-query-item.repository';
import UserRepository from '../repository/user.repository';
import SubscriptionRepository from '../repository/subscription.repository';

jest.mock('better-sqlite3', () => jest.fn(() => 'sqlite database'));
jest.mock('../repository/external-source.repository');
jest.mock('../repository/ip-filter.repository');
jest.mock('../repository/proxy.repository');
jest.mock('../repository/scan-mode.repository');
jest.mock('../repository/engine.repository');
jest.mock('../repository/north-connector.repository');
jest.mock('../repository/south-connector.repository');
jest.mock('../repository/south-item.repository');
jest.mock('../repository/log.repository');
jest.mock('../repository/history-query.repository');
jest.mock('../repository/history-query-item.repository');
jest.mock('../repository/user.repository');
jest.mock('../repository/subscription.repository');

describe('Repository service', () => {
  it('should properly initialize service', () => {
    const repositoryService = new RepositoryService('myConfigDatabase', 'myLogDatabase');
    expect(db).toHaveBeenCalledWith('myConfigDatabase');
    expect(db).toHaveBeenCalledWith('myLogDatabase');
    expect(EngineRepository).toHaveBeenCalledWith('sqlite database');
    expect(ExternalSourceRepository).toHaveBeenCalledWith('sqlite database');
    expect(IpFilterRepository).toHaveBeenCalledWith('sqlite database');
    expect(ProxyRepository).toHaveBeenCalledWith('sqlite database');
    expect(ScanModeRepository).toHaveBeenCalledWith('sqlite database');
    expect(NorthConnectorRepository).toHaveBeenCalledWith('sqlite database');
    expect(SouthConnectorRepository).toHaveBeenCalledWith('sqlite database');
    expect(SouthItemRepository).toHaveBeenCalledWith('sqlite database');
    expect(LogRepository).toHaveBeenCalledWith('sqlite database');
    expect(HistoryQueryRepository).toHaveBeenCalledWith('sqlite database');
    expect(HistoryQueryItemRepository).toHaveBeenCalledWith('sqlite database');
    expect(UserRepository).toHaveBeenCalledWith('sqlite database');
    expect(SubscriptionRepository).toHaveBeenCalledWith('sqlite database');

    expect(repositoryService.engineRepository).toBeDefined();
    expect(repositoryService.externalSourceRepository).toBeDefined();
    expect(repositoryService.ipFilterRepository).toBeDefined();
    expect(repositoryService.proxyRepository).toBeDefined();
    expect(repositoryService.scanModeRepository).toBeDefined();
    expect(repositoryService.northConnectorRepository).toBeDefined();
    expect(repositoryService.southConnectorRepository).toBeDefined();
    expect(repositoryService.southItemRepository).toBeDefined();
    expect(repositoryService.logRepository).toBeDefined();
    expect(repositoryService.historyQueryRepository).toBeDefined();
    expect(repositoryService.historyQueryItemRepository).toBeDefined();
    expect(repositoryService.userRepository).toBeDefined();
    expect(repositoryService.subscriptionRepository).toBeDefined();
  });
});
