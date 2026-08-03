import { BaseEntity } from './types';
import { ActivationWindow, ScanModeInterval, ScanModeType } from '../../shared/model/scan-mode.model';

export interface ScanMode extends BaseEntity {
  name: string;
  description: string;
  type: ScanModeType;
  cron: string;
  interval: ScanModeInterval | null;
  activationWindow: ActivationWindow | null;
}
