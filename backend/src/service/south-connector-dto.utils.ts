import { SouthConnectorItemTypedDTO, SouthItemGroupDTO } from '../../shared/model/api/south-connector.model';
import { GetUserInfo } from '../../shared/model/common/types';
import { OIBusObjectAttribute } from '../../shared/model/connector/form.model';
import { SouthItemSettings } from '../../shared/model/connector/south-settings.model';

import { SouthConnectorItemEntity, SouthConnectorItemEntityLight, SouthItemGroupEntityLight } from '../model/south-connector.model';
import { encryptionService } from './encryption.service';
import { toScanModeDTO } from './scan-mode-dto.utils';
import { southManifestList } from './south-manifests';

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
      startTimeOffset: entity.startTimeOffset,
      endTimeOffset: entity.endTimeOffset,
      maxReadInterval: entity.maxReadInterval,
      readDelay: entity.readDelay,
      recoveryStrategy: entity.recoveryStrategy,
      cachingStrategy: entity.cachingStrategy
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
    startTimeOffset: entity.startTimeOffset,
    endTimeOffset: entity.endTimeOffset,
    recoveryStrategy: entity.recoveryStrategy,
    cachingStrategy: entity.cachingStrategy,
    thresholdType: entity.thresholdType,
    threshold: entity.threshold,
    rangeLow: entity.rangeLow,
    rangeHigh: entity.rangeHigh,
    maxCachingInterval: entity.maxCachingInterval
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
