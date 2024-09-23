import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { BaseEntity } from './types';

export interface SouthConnectorEntityLight extends BaseEntity {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
}

export interface SouthConnectorEntity<T extends SouthSettings, I extends SouthItemSettings> extends BaseEntity {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: T;
  sharedConnection: boolean;
  history: {
    maxInstantPerItem: boolean;
    maxReadInterval: number;
    readDelay: number;
    overlap: number;
  };
  items: Array<SouthConnectorItemEntity<I>>;
}

export interface SouthConnectorItemEntity<T extends SouthItemSettings> extends BaseEntity {
  name: string;
  enabled: boolean;
  scanModeId: string;
  settings: T;
}
