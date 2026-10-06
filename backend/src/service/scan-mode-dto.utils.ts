import { DateTime } from 'luxon';

import { ScanModeDTO } from '../../shared/model/api/scan-mode.model';
import { GetUserInfo } from '../../shared/model/common/types';

import { ScanMode } from '../model/scan-mode.model';
import { isActivationWindowExpired } from './scan-mode.utils';

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
