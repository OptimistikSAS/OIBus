import { HistoryQueryItemCommandDTO } from '@oibus/shared/api/history-query.model';
import { SouthConnectorItemCommandDTO } from '@oibus/shared/api/south-connector.model';

/** A new item of a history query, from an item discovered for a south connector: a history query item has no schedule */
export function toHistoryQueryItemCommand(command: SouthConnectorItemCommandDTO): HistoryQueryItemCommandDTO {
  return { id: '', name: command.name, enabled: command.enabled, settings: command.settings } as HistoryQueryItemCommandDTO;
}
