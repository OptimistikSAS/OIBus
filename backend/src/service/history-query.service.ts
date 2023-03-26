import ProxyService from './proxy.service';
import EncryptionService from './encryption.service';
import RepositoryService from './repository.service';

import { OibusItemDTO } from '../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../shared/model/history-query.model';

export default class HistoryQueryService {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly encryptionService: EncryptionService,
    private readonly repositoryService: RepositoryService
  ) {}

  getHistoryQuery(historyQueryId: string): HistoryQueryDTO | null {
    return this.repositoryService.historyQueryRepository.getHistoryQuery(historyQueryId);
  }

  getHistoryQueryList(): Array<HistoryQueryDTO> {
    return this.repositoryService.historyQueryRepository.getHistoryQueries();
  }

  getItems(historyQueryId: string): Array<OibusItemDTO> {
    return this.repositoryService.historyQueryItemRepository.getHistoryItems(historyQueryId);
  }
}
