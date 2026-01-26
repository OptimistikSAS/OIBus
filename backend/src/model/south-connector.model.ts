import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { BaseEntity } from './types';
import { OIBusSouthType } from '../../shared/model/south-connector.model';
import { ScanMode } from './scan-mode.model';

export interface SouthConnectorEntityLight extends BaseEntity {
  name: string;
  type: OIBusSouthType;
  description: string;
  enabled: boolean;
}

export interface SouthConnectorItemEntityLight extends BaseEntity {
  name: string;
}

export interface SouthItemGroupEntity extends BaseEntity {
  name: string;
  southId: string;
  scanMode: ScanMode;
  shareTrackedInstant: boolean;
  overlap: number | null;
}

export interface SouthConnectorEntity<S extends SouthSettings, I extends SouthItemSettings> extends BaseEntity {
  name: string;
  type: OIBusSouthType;
  description: string;
  enabled: boolean;
  settings: S;
  items: Array<SouthConnectorItemEntity<I>>;
}

export interface SouthConnectorItemEntity<I extends SouthItemSettings> extends BaseEntity {
  name: string;
  enabled: boolean;
  scanMode: ScanMode;
  settings: I;
  groups: Array<SouthItemGroupEntity>;
}

export interface SouthThrottlingSettings {
  maxReadInterval: number;
  readDelay: number;
}
