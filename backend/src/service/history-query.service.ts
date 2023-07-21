import RepositoryService from './repository.service';

import { SouthConnectorItemDTO } from '../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../shared/model/history-query.model';
import { SouthItemSettings } from '../../../shared/model/south-settings.model';

export default class HistoryQueryService {
  constructor(readonly repositoryService: RepositoryService) {}

  getHistoryQuery(historyQueryId: string): HistoryQueryDTO | null {
    return this.repositoryService.historyQueryRepository.getHistoryQuery(historyQueryId);
  }

  getHistoryQueryList(): Array<HistoryQueryDTO> {
    return this.repositoryService.historyQueryRepository.getHistoryQueries();
  }

  getItems<I extends SouthItemSettings>(historyQueryId: string): Array<SouthConnectorItemDTO<I>> {
    return this.repositoryService.historyQueryItemRepository.getHistoryItems(historyQueryId);
  }

  stopHistoryQuery(historyQueryId: string): void {
    return this.repositoryService.historyQueryRepository.stopHistoryQuery(historyQueryId);
  }
}
