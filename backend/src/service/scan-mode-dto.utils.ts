import { ScanModeDTO } from '../../shared/model/scan-mode.model';
import { ScanMode } from '../model/scan-mode.model';
import { GetUserInfo } from '../../shared/model/types';

export const toScanModeDTO = (scanMode: ScanMode, getUserInfo: GetUserInfo): ScanModeDTO => {
  return {
    id: scanMode.id,
    name: scanMode.name,
    description: scanMode.description,
    cron: scanMode.cron,
    createdBy: getUserInfo(scanMode.createdBy),
    updatedBy: getUserInfo(scanMode.updatedBy),
    createdAt: scanMode.createdAt,
    updatedAt: scanMode.updatedAt
  };
};
