import RepositoryService from './repository.service';

import { SouthConnectorItemDTO, SouthConnectorItemSearchParam } from '../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../shared/model/history-query.model';
import { SouthItemSettings } from '../../../shared/model/south-settings.model';

export default class HistoryQueryService {
  constructor(readonly repositoryService: RepositoryService) {}

  getHistoryQuery(historyQueryId: string): HistoryQueryDTO | null {
    return this.repositoryService.historyQueryRepository.findById(historyQueryId);
  }

  getHistoryQueryList(): Array<HistoryQueryDTO> {
    return this.repositoryService.historyQueryRepository.findAll();
  }

  listItems<I extends SouthItemSettings>(
    historyQueryId: string,
    searchParams: SouthConnectorItemSearchParam
  ): Array<SouthConnectorItemDTO<I>> {
    return this.repositoryService.historyQueryItemRepository.list(historyQueryId, searchParams);
  }
}
