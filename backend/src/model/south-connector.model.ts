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
  enabled: boolean;
}

export interface SouthItemGroupEntityLight extends BaseEntity {
  name: string;
  scanMode: ScanMode;
  overlap: number | null;
  maxReadInterval: number | null;
  readDelay: number | null;
}

export interface SouthItemGroupEntity extends BaseEntity {
  name: string;
  southId: string;
  scanMode: ScanMode;
  overlap: number | null;
  maxReadInterval: number | null;
  readDelay: number | null;
  items: Array<SouthConnectorItemEntityLight>;
}

export interface SouthItemGroupCommand {
  name: string;
  southId: string;
  scanMode: ScanMode;
  overlap: number | null;
  maxReadInterval: number | null;
  readDelay: number | null;
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
  group: SouthItemGroupEntityLight | null;
  syncWithGroup: boolean;
  maxReadInterval: number | null;
  readDelay: number | null;
  overlap: number | null;
}
