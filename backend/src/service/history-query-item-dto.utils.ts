import { HistoryQueryItemTypedDTO } from '../../shared/model/history-query.model';
import { SouthItemSettings } from '../../shared/model/south-settings.model';
import { HistoryQueryItemEntity } from '../model/histor-query.model';
import { OIBusObjectAttribute } from '../../shared/model/form.model';
import { GetUserInfo } from '../../shared/model/types';
import { encryptionService } from './encryption.service';
import { southManifestList } from './south-manifests';

export const toHistoryQueryItemDTO = (
  historyQueryItem: HistoryQueryItemEntity<SouthItemSettings>,
  southType: string,
  getUserInfo: GetUserInfo
): HistoryQueryItemTypedDTO<SouthItemSettings> => {
  const southManifest = southManifestList.find(element => element.id === southType)!;
  const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
    attribute => attribute.key === 'settings'
  )! as OIBusObjectAttribute;
  return {
    id: historyQueryItem.id,
    name: historyQueryItem.name,
    enabled: historyQueryItem.enabled,
    settings: encryptionService.filterSecrets<SouthItemSettings>(historyQueryItem.settings, itemSettingsManifest),
    createdBy: getUserInfo(historyQueryItem.createdBy),
    updatedBy: getUserInfo(historyQueryItem.updatedBy),
    createdAt: historyQueryItem.createdAt,
    updatedAt: historyQueryItem.updatedAt
  };
};
