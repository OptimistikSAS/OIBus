import { SouthConnectorItemTypedDTO, SouthItemGroupDTO } from '../../shared/model/south-connector.model';
import { SouthItemSettings } from '../../shared/model/south-settings.model';
import { SouthConnectorItemEntity, SouthConnectorItemEntityLight, SouthItemGroupEntityLight } from '../model/south-connector.model';
import { OIBusObjectAttribute } from '../../shared/model/form.model';
import { GetUserInfo } from '../../shared/model/types';
import { encryptionService } from './encryption.service';
import { southManifestList } from './south-manifests';
import { toScanModeDTO } from './scan-mode-dto.utils';

export const toSouthItemGroupDTO = (entity: SouthItemGroupEntityLight, getUserInfo: GetUserInfo): SouthItemGroupDTO => {
  return {
    id: entity.id,
    createdBy: getUserInfo(entity.createdBy),
    updatedBy: getUserInfo(entity.updatedBy),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    standardSettings: {
      name: entity.name,
      scanMode: toScanModeDTO(entity.scanMode, getUserInfo)
    },
    historySettings: {
      overlap: entity.overlap,
      maxReadInterval: entity.maxReadInterval,
      readDelay: entity.readDelay
    }
  };
};

export const toSouthConnectorItemDTO = (
  entity: SouthConnectorItemEntity<SouthItemSettings>,
  southType: string,
  getUserInfo: GetUserInfo
): SouthConnectorItemTypedDTO<SouthItemSettings> => {
  const manifest = southManifestList.find(element => element.id === southType)!;
  const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
    attribute => attribute.key === 'settings'
  )! as OIBusObjectAttribute;
  return {
    id: entity.id,
    name: entity.name,
    enabled: entity.enabled,
    scanMode: entity.scanMode ? toScanModeDTO(entity.scanMode, getUserInfo) : null,
    settings: encryptionService.filterSecrets(entity.settings, itemSettingsManifest),
    createdBy: getUserInfo(entity.createdBy),
    updatedBy: getUserInfo(entity.updatedBy),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    group: entity.group ? toSouthItemGroupDTO(entity.group, getUserInfo) : null,
    syncWithGroup: entity.syncWithGroup,
    maxReadInterval: entity.maxReadInterval,
    readDelay: entity.readDelay,
    overlap: entity.overlap
  };
};

export const toSouthItemLightDTO = (entity: SouthConnectorItemEntityLight, getUserInfo: GetUserInfo) => {
  return {
    id: entity.id,
    name: entity.name,
    enabled: entity.enabled,
    createdBy: getUserInfo(entity.createdBy),
    updatedBy: getUserInfo(entity.updatedBy),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
};
