import { ScanModeDTO } from '../../shared/model/scan-mode.model';
import { ScanMode } from '../model/scan-mode.model';
import { GetUserInfo } from '../../shared/model/types';
import { isActivationWindowExpired } from './scan-mode.utils';
import { DateTime } from 'luxon';

export const toScanModeDTO = (scanMode: ScanMode, getUserInfo: GetUserInfo): ScanModeDTO => {
  return {
    id: scanMode.id,
    name: scanMode.name,
    description: scanMode.description,
    type: scanMode.type,
    cron: scanMode.cron,
    interval: scanMode.interval,
    activationWindow: scanMode.activationWindow,
    activationWindowExpired: isActivationWindowExpired(scanMode.activationWindow, DateTime.utc()),
    createdBy: getUserInfo(scanMode.createdBy),
    updatedBy: getUserInfo(scanMode.updatedBy),
    createdAt: scanMode.createdAt,
    updatedAt: scanMode.updatedAt
  };
};
