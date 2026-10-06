import { ActivationWindow, ScanModeInterval, ScanModeType } from '../../shared/model/domain/scan-mode.model';

import { BaseEntity } from './types';

export interface ScanMode extends BaseEntity {
  name: string;
  description: string;
  type: ScanModeType;
  cron: string;
  interval: ScanModeInterval | null;
  activationWindow: ActivationWindow | null;
}
