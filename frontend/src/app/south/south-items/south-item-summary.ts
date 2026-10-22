import { SouthConnectorItemDTO } from '@oibus/shared/api/south-connector.model';
import { OIBusObjectAttribute, OIBusScanModeAttribute } from '@oibus/shared/connector/form.model';
import { IOT_FAMILY_SOUTH_TYPES, SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthCachingStrategy, SouthCachingThresholdType, SouthHistoryRecoveryStrategy } from '@oibus/shared/domain/south-connector.model';

import { SettingsSummaryContext, SettingSummary, summarizeSettings } from '../../shared/form/oibus-settings-summary/settings-summary';
import { ItemSummary } from './item-modal-steps';

export const RECOVERY_STRATEGIES: Array<{ value: SouthHistoryRecoveryStrategy; labelKey: string }> = [
  { value: 'newest', labelKey: 'south.items.recovery-strategy-newest' },
  { value: 'oldest', labelKey: 'south.items.recovery-strategy-oldest' }
];

export const CACHING_STRATEGIES: Array<{ value: SouthCachingStrategy; labelKey: string }> = [
  { value: 'allValues', labelKey: 'south.items.caching-strategy-all-values' },
  { value: 'onChange', labelKey: 'south.items.caching-strategy-on-change' },
  { value: 'threshold', labelKey: 'south.items.caching-strategy-threshold' }
];

export const THRESHOLD_TYPES: Array<{ value: SouthCachingThresholdType; labelKey: string }> = [
  { value: 'absolute', labelKey: 'south.items.threshold-type-absolute' },
  { value: 'percentage', labelKey: 'south.items.threshold-type-percentage' }
];

/** A south item as summed up: its history settings and caching strategy are its group's while it is synced with it */
export interface SouthItemSummaryValues {
  name: string;
  enabled: boolean;
  /** Null when the item has no group */
  groupName: string | null;
  scanModeName: string | null;
  syncWithGroup: boolean;
  maxReadInterval: number | null;
  readDelay: number | null;
  recoveryStrategy: SouthHistoryRecoveryStrategy | null;
  startTimeOffset: number | null;
  endTimeOffset: number | null;
  cachingStrategy: SouthCachingStrategy | null;
  thresholdType: SouthCachingThresholdType | null;
  threshold: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  maxCachingInterval: number | null;
  settings: object;
}

export function getItemSettingsAttribute(manifest: SouthConnectorManifest): OIBusObjectAttribute {
  return manifest.items.rootAttribute.attributes.find(element => element.key === 'settings')! as OIBusObjectAttribute;
}

export function getScanModeAttribute(manifest: SouthConnectorManifest): OIBusScanModeAttribute {
  return manifest.items.rootAttribute.attributes.find(element => element.key === 'scanMode')! as OIBusScanModeAttribute;
}

/**
 * A saved item, to be summed up. The history settings and caching strategy of an item synced with its group are left empty in it:
 * the group's apply.
 */
export function toSouthItemSummaryValues(item: SouthConnectorItemDTO): SouthItemSummaryValues {
  const synced = item.group !== null && item.syncWithGroup;
  const history = synced ? item.group!.historySettings : item;
  return {
    name: item.name,
    enabled: item.enabled,
    groupName: item.group?.standardSettings.name ?? null,
    scanModeName: (item.group ? item.group.standardSettings.scanMode : item.scanMode)?.name ?? null,
    syncWithGroup: synced,
    maxReadInterval: history.maxReadInterval,
    readDelay: history.readDelay,
    recoveryStrategy: history.recoveryStrategy,
    startTimeOffset: history.startTimeOffset,
    endTimeOffset: history.endTimeOffset,
    cachingStrategy: history.cachingStrategy,
    thresholdType: item.thresholdType,
    threshold: item.threshold,
    rangeLow: item.rangeLow,
    rangeHigh: item.rangeHigh,
    maxCachingInterval: item.maxCachingInterval,
    settings: item.settings
  };
}

/**
 * Sums up a south item: its general settings (with its history and caching settings, when its connector type has them) and the
 * settings of its connector type. `context.isInvalid` is given the path of a setting in the item form (e.g. `['name']`,
 * `['settings', 'query']`).
 */
export function summarizeSouthItem(
  item: SouthItemSummaryValues,
  manifest: SouthConnectorManifest,
  context: SettingsSummaryContext
): ItemSummary {
  const translate = (key: string): string => context.translateService.instant(key);
  const text = (labelKey: string, value: string | number | null, controlKey?: string, unitKey?: string): SettingSummary => ({
    kind: 'text',
    labelKey,
    text: value === null || value === '' ? null : unitKey ? `${value} ${translate(unitKey)}` : String(value),
    invalid: controlKey ? (context.isInvalid?.([controlKey]) ?? false) : false
  });
  const optionLabel = <T>(options: Array<{ value: T; labelKey: string }>, value: T | null): string | null => {
    const option = options.find(candidate => candidate.value === value);
    return option ? translate(option.labelKey) : null;
  };

  const general: Array<SettingSummary> = [
    text('south.items.name', item.name, 'name'),
    text('south.items.status', translate(item.enabled ? 'common.enabled' : 'common.disabled')),
    text('south.items.group', item.groupName ?? translate('south.items.group-none'))
  ];
  if (getScanModeAttribute(manifest).acceptableType !== 'SUBSCRIPTION') {
    general.push(text('configuration.oibus.manifest.south.items.scan-mode', item.scanModeName, 'scanModeId'));
  }
  if (manifest.modes.history) {
    const history: Array<SettingSummary> = [];
    if (item.groupName !== null) {
      history.push({ kind: 'boolean', labelKey: 'south.items.sync-with-group', value: item.syncWithGroup });
    }
    history.push(
      text('south.items.max-read-interval', item.maxReadInterval, 'maxReadInterval', 'common.unit.s'),
      text('south.items.read-delay', item.readDelay, 'readDelay', 'common.unit.ms'),
      text('south.items.recovery-strategy', optionLabel(RECOVERY_STRATEGIES, item.recoveryStrategy)),
      text('south.items.start-time-offset', item.startTimeOffset, 'startTimeOffset', 'common.unit.ms'),
      text('south.items.end-time-offset', item.endTimeOffset, 'endTimeOffset', 'common.unit.ms')
    );
    general.push({ kind: 'group', labelKey: 'south.edit-item-modal.history-settings', settings: history });
  }
  if (IOT_FAMILY_SOUTH_TYPES.includes(manifest.id)) {
    const strategy = item.cachingStrategy;
    const caching = [text('south.items.caching-strategy', optionLabel(CACHING_STRATEGIES, strategy), 'cachingStrategy')];
    if (strategy === 'threshold') {
      caching.push(
        text('south.items.threshold-type', optionLabel(THRESHOLD_TYPES, item.thresholdType), 'thresholdType'),
        text('south.items.threshold', item.threshold, 'threshold')
      );
      if (item.thresholdType === 'percentage') {
        caching.push(text('south.items.range-low', item.rangeLow, 'rangeLow'), text('south.items.range-high', item.rangeHigh, 'rangeHigh'));
      }
    }
    if (strategy !== 'allValues') {
      caching.push(text('south.items.max-caching-interval', item.maxCachingInterval, 'maxCachingInterval', 'common.unit.ms'));
    }
    general.push({ kind: 'group', labelKey: 'south.edit-item-modal.caching', settings: caching });
  }

  const settings = summarizeSettings(getItemSettingsAttribute(manifest), item.settings, context, ['settings']);
  return { general, settings };
}
