import { TranslateService } from '@ngx-translate/core';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { OIBusAttribute, OIBusObjectAttribute } from '@oibus/shared/connector/form.model';

import { checkCondition } from '../dynamic-form.builder';
import { FormUtils } from '../form-utils';

/** How the value of a setting shows */
export type SettingValue =
  | { kind: 'text'; text: string | null }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'code'; code: string | null }
  | { kind: 'table'; columnKeys: Array<string>; rows: Array<Array<string>> };

/** A setting as summed up: its label (a translation key), its value, and whether it has an error; or a group of settings */
export type SettingSummary =
  (SettingValue & { labelKey: string; invalid?: boolean }) | { kind: 'group'; labelKey: string; settings: Array<SettingSummary> };

/** A setting as shown: compared with the same setting in a previous version, if there is one to compare with */
export interface SettingView {
  setting: SettingSummary;
  /** The setting differs from the previous version, or wasn't in it */
  changed: boolean;
  /** The same setting in the previous version, null when it wasn't there or when there is nothing to compare with */
  previous: SettingSummary | null;
  /** The settings of a group */
  children: Array<SettingView>;
}

export interface SettingsSummaryContext {
  translateService: TranslateService;
  scanModes?: Array<ScanModeDTO>;
  certificates?: Array<CertificateDTO>;
  /** Whether the setting at this path (from the summed up object) has an error */
  isInvalid?: (path: Array<string>) => boolean;
  /**
   * Leaves out the settings that their enabling condition turns off. A form leaves them out of its value already, a saved value
   * (e.g. of a connector) still has them.
   */
  applyEnablingConditions?: boolean;
}

/** Shown in place of a secret, so that it is never displayed */
const SECRET_MASK = '••••••••';

/**
 * Sums up settings edited with `oib-oibus-object-form-control`, from their manifest: the settings that the form leaves out of its
 * value (disabled by an enabling condition) are left out here too.
 */
export function summarizeSettings(
  objectAttribute: OIBusObjectAttribute,
  value: object | null | undefined,
  context: SettingsSummaryContext,
  path: Array<string> = []
): Array<SettingSummary> {
  const values = (value ?? {}) as Record<string, unknown>;
  const enabled = (attribute: OIBusAttribute) => {
    const condition = objectAttribute.enablingConditions.find(candidate => candidate.targetPathFromRoot === attribute.key);
    return !context.applyEnablingConditions || !condition || checkCondition(values[condition.referralPathFromRoot] ?? null, condition);
  };
  return objectAttribute.attributes
    .filter(attribute => attribute.key in values && enabled(attribute))
    .map(attribute => summarizeAttribute(attribute, values[attribute.key], context, [...path, attribute.key]))
    .filter((setting): setting is SettingSummary => setting !== null);
}

function summarizeAttribute(
  attribute: OIBusAttribute,
  value: unknown,
  context: SettingsSummaryContext,
  path: Array<string>
): SettingSummary | null {
  const empty = value === null || value === undefined || value === '';
  const invalid = context.isInvalid?.(path) ?? false;
  const text = (labelKey: string, shown: () => string): SettingSummary => ({
    kind: 'text',
    labelKey,
    text: empty ? null : shown(),
    invalid
  });
  switch (attribute.type) {
    case 'object':
      if (!attribute.displayProperties.visible || empty) {
        return null;
      }
      return { kind: 'group', labelKey: attribute.translationKey, settings: summarizeSettings(attribute, value as object, context, path) };
    case 'array': {
      const columns = FormUtils.buildColumn(attribute.rootAttribute.attributes, []);
      const elements = (value as Array<Record<string, unknown>> | null) ?? [];
      return {
        kind: 'table',
        labelKey: attribute.rootAttribute.translationKey,
        columnKeys: columns.map(column => (column.type === 'string-select' ? `${column.translationKey}.title` : column.translationKey)),
        rows: elements.map(element =>
          columns.map(column =>
            String(
              FormUtils.formatValue(
                element,
                column.path,
                column.type,
                column.translationKey,
                context.translateService,
                context.scanModes ?? []
              ) ?? ''
            )
          )
        ),
        invalid
      };
    }
    case 'boolean':
      return { kind: 'boolean', labelKey: attribute.translationKey, value: !!value, invalid };
    case 'code':
      return { kind: 'code', labelKey: attribute.translationKey, code: empty ? null : String(value), invalid };
    case 'string-select':
      return text(`${attribute.translationKey}.title`, () => context.translateService.instant(`${attribute.translationKey}.${value}`));
    case 'number':
      return text(attribute.translationKey, () => (attribute.unit ? `${value} ${attribute.unit}` : String(value)));
    case 'secret':
      return text(attribute.translationKey, () => SECRET_MASK);
    case 'scan-mode':
      return text(attribute.translationKey, () => context.scanModes?.find(scanMode => scanMode.id === value)?.name ?? String(value));
    case 'certificate':
      return text(
        attribute.translationKey,
        () => context.certificates?.find(certificate => certificate.id === value)?.name ?? String(value)
      );
    case 'string':
    case 'instant':
    case 'timezone':
      return text(attribute.translationKey, () => String(value));
  }
}

/** The value of a setting, to compare it with another version: its label and error are left out */
function comparable(setting: SettingSummary): string {
  if (setting.kind === 'group') {
    return '';
  }
  const { labelKey: _labelKey, invalid: _invalid, ...value } = setting;
  return JSON.stringify(value);
}

/**
 * Compares settings with a previous version of them (e.g. as saved), matching them by label. With no previous version
 * (null), nothing is marked as changed.
 */
export function compareSettings(settings: Array<SettingSummary>, previous: Array<SettingSummary> | null): Array<SettingView> {
  return settings.map(setting => {
    const previousSetting = previous?.find(candidate => candidate.labelKey === setting.labelKey && candidate.kind === setting.kind) ?? null;
    if (setting.kind === 'group') {
      // a group missing from the previous version is new, and so are all its settings
      const previousChildren = previousSetting?.kind === 'group' ? previousSetting.settings : [];
      return { setting, changed: false, previous: null, children: compareSettings(setting.settings, previous ? previousChildren : null) };
    }
    const changed = previous !== null && (!previousSetting || comparable(previousSetting) !== comparable(setting));
    return { setting, changed, previous: changed ? previousSetting : null, children: [] };
  });
}

/** The number of settings changed, groups' ones included */
export function countChanges(views: Array<SettingView>): number {
  return views.reduce((count, view) => count + (view.changed ? 1 : 0) + countChanges(view.children), 0);
}
