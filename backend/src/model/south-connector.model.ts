import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { BaseEntity } from './types';
import { OIBusSouthType, SouthHistoryRecoveryStrategy } from '../../shared/model/south-connector.model';
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
  startTimeOffset: number | null;
  endTimeOffset: number | null;
  maxReadInterval: number | null;
  readDelay: number | null;
  recoveryStrategy: SouthHistoryRecoveryStrategy | null;
}

export interface SouthItemGroupEntity extends BaseEntity {
  name: string;
  southId: string;
  scanMode: ScanMode;
  startTimeOffset: number | null;
  endTimeOffset: number | null;
  maxReadInterval: number | null;
  readDelay: number | null;
  recoveryStrategy: SouthHistoryRecoveryStrategy | null;
  items: Array<SouthConnectorItemEntityLight>;
}

export interface SouthItemGroupCommand {
  name: string;
  southId: string;
  scanMode: ScanMode;
  startTimeOffset: number | null;
  endTimeOffset: number | null;
  maxReadInterval: number | null;
  readDelay: number | null;
  recoveryStrategy: SouthHistoryRecoveryStrategy | null;
}

export interface SouthConnectorEntity<S extends SouthSettings, I extends SouthItemSettings> extends BaseEntity {
  name: string;
  type: OIBusSouthType;
  description: string;
  enabled: boolean;
  settings: S;
  items: Array<SouthConnectorItemEntity<I>>;
  groups: Array<SouthItemGroupEntityLight>;
}

export interface SouthConnectorItemEntity<I extends SouthItemSettings> extends BaseEntity {
  name: string;
  enabled: boolean;
  scanMode: ScanMode | null;
  settings: I;
  group: SouthItemGroupEntityLight | null;
  syncWithGroup: boolean;
  maxReadInterval: number | null;
  readDelay: number | null;
  startTimeOffset: number | null;
  endTimeOffset: number | null;
  recoveryStrategy: SouthHistoryRecoveryStrategy | null;

  /**
   * The Configuration Workflow that created this item, for a self-scoping (multi-item) workflow — the
   * sole ownership record, never a group. Null/undefined for an item created by hand, via CSV import,
   * or by a workflow that targets a single pre-existing item rather than owning it. Set only by
   * workflow-specific repository methods, never by the normal item create/update path.
   *
   * Optional (rather than required) specifically so the hundred-plus existing test fixtures across
   * every south connector that build a `SouthConnectorItemEntity` literal don't all need touching for
   * a field that's irrelevant to them — the repository always populates it (as `string | null`) when
   * reading a real item from the database.
   */
  createdByWorkflowId?: string | null;

  /**
   * Set only when a Configuration Workflow auto-disabled this item because its discovery no longer
   * finds the entry it corresponds to. A person's own manual disable leaves this null, so the two are
   * never confused without a second boolean alongside `enabled`. Optional for the same reason as
   * `createdByWorkflowId` above.
   */
  disabledReason?: string | null;
}
